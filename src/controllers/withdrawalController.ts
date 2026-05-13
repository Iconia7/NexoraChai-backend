import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { initiateB2CPayment } from '../lib/daraja';
import { withdrawalSchema } from '../lib/schemas';

const calculateB2CFee = (amount: number): number => {
    if (amount <= 100) return 0;
    if (amount <= 1500) return 5;
    if (amount <= 5000) return 9;
    if (amount <= 20000) return 11;
    return 13; // For 20,001 to 250,000
};

export const requestWithdrawal = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    
    try {
        const validated = withdrawalSchema.partial({ mpesaNumber: true }).parse({ 
            amount: req.body.grossAmount,
            mpesaNumber: '0712345678' // Dummy for schema validation if not partialized, but I'll use partial
        });
        const grossAmount = validated.amount;

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Fetch creator and wallet
            const creator = await tx.creatorProfile.findUnique({
                where: { userId },
                include: { wallet: true }
            });

            if (!creator || !creator.wallet) {
                throw new Error('Creator or Wallet not found');
            }

            if (creator.wallet.balance < grossAmount) {
                throw new Error('Insufficient wallet balance');
            }

            // 2. Calculate fees
            const networkFee = calculateB2CFee(grossAmount);
            const netAmount = grossAmount - networkFee;

            if (netAmount <= 0) {
                throw new Error('Withdrawal amount too small to cover fees');
            }

            // 3. Deduct from wallet
            await tx.creatorWallet.update({
                where: { id: creator.wallet.id },
                data: { balance: { decrement: grossAmount } }
            });

            // 4. Create pending transaction
            const transaction = await tx.paymentTransaction.create({
                data: {
                    creatorId: creator.id,
                    type: 'WITHDRAWAL',
                    grossAmount,
                    networkFee,
                    netAmount,
                    status: 'PENDING',
                    gateway: 'MPESA'
                }
            });

            return { creator, transaction, netAmount };
        });

        // 5. Trigger Daraja B2C (Outside transaction to avoid holding DB lock during API call)
        try {
            const b2cData = await initiateB2CPayment({
                phoneNumber: result.creator.mpesaNumber || '',
                amount: result.netAmount,
                remarks: `Withdrawal for ${result.creator.username}`,
                occasion: 'Withdrawal'
            });

            // Update transaction with OriginatorConversationID or similar for tracking
            await (prisma.paymentTransaction as any).update({
                where: { id: result.transaction.id },
                data: { gatewayReference: b2cData.OriginatorConversationID }
            });

            res.json({
                message: 'Withdrawal initiated successfully',
                transactionId: result.transaction.id,
                netAmount: result.netAmount
            });

        } catch (apiError: any) {
            console.error('B2C API Error:', apiError.message);
            // Note: If API fails here, we might want to refund immediately, 
            // but usually we rely on the webhook. For immediate API failures:
            await prisma.$transaction([
                (prisma.creatorWallet as any).update({
                    where: { creatorId: result.creator.id },
                    data: { balance: { increment: grossAmount } }
                }),
                (prisma.paymentTransaction as any).update({
                    where: { id: result.transaction.id },
                    data: { status: 'FAILED' }
                })
            ]);
            throw new Error(`Daraja API error: ${apiError.message}`);
        }

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message });
        }
        console.error('Withdrawal Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
