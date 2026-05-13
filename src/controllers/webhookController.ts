import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const handleB2CResult = async (req: Request, res: Response) => {
    console.log('--- Received Daraja B2C Callback ---');
    
    // Security Check: Verify secret token
    const { token } = req.query;
    if (token !== process.env.WEBHOOK_SECRET) {
        console.error('❌ Unauthorized B2C callback attempt');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { Result } = req.body;
    if (!Result) {
        return res.status(400).json({ error: 'Invalid B2C callback data' });
    }

    const { OriginatorConversationID, ResultCode, ResultDesc } = Result;

    try {
        const transaction = await prisma.paymentTransaction.findUnique({
            where: { gatewayReference: OriginatorConversationID }
        });

        if (!transaction) {
            console.error(`Transaction not found for reference: ${OriginatorConversationID}`);
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Idempotency check: Only process if PENDING
        if (transaction.status !== 'PENDING') {
            console.warn(`⚠️ B2C Result already processed for: ${transaction.id}`);
            return res.json({ ResultCode: 0, ResultDesc: 'Already Processed' });
        }

        if (ResultCode === 0) {
            // Success
            await prisma.paymentTransaction.update({
                where: { id: transaction.id },
                data: { status: 'COMPLETED' }
            });

            // Create notification
            await (prisma as any).notification.create({
                data: {
                    creatorId: transaction.creatorId,
                    type: 'SUCCESS',
                    title: 'Withdrawal Successful! 💸',
                    message: `Your withdrawal of KES ${transaction.grossAmount.toLocaleString()} to M-Pesa has been completed.`
                }
            });

            console.log(`✅ B2C Withdrawal Success: ${transaction.id}`);
        } else {
            // Failure - Refund the creator
            console.warn(`❌ B2C Withdrawal Failed: ${transaction.id} (${ResultDesc}). Refunding...`);

            await prisma.$transaction(async (tx) => {
                // 1. Update transaction status
                await tx.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'FAILED' }
                });

                // 2. Refund grossAmount back to wallet
                await tx.creatorWallet.update({
                    where: { creatorId: transaction.creatorId },
                    data: { balance: { increment: transaction.grossAmount } }
                });
            });

            console.log(`💰 Refunded KES ${transaction.grossAmount} to creator ${transaction.creatorId}`);
        }

        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err: any) {
        console.error(`❌ B2C Callback Processing Error:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const handleB2CTimeout = async (req: Request, res: Response) => {
    console.error('⚠️ Daraja B2C Timeout:', req.body);
    // Usually, we treat timeout as a potential failure or check status later
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};
