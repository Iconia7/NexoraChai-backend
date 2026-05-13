import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { initializeTransaction } from '../lib/paystack';
import { initiateSTKPush } from '../lib/daraja';
import { mpesaPaymentSchema, cardPaymentSchema } from '../lib/schemas';
import crypto from 'crypto';

export const initializeMpesa = async (req: Request, res: Response) => {
  try {
    const validated = mpesaPaymentSchema.parse(req.body);
    const { creatorId, amount, phoneNumber, fanName, fanMessage } = validated;

    const creator = await prisma.creatorProfile.findUnique({ where: { id: creatorId } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const nexoraFee = amount * 0.02; // 2% fee
    const grossAmount = amount + nexoraFee;
    const netAmount = amount;

    const darajaData = await initiateSTKPush({
      phoneNumber,
      amount: grossAmount,
      accountReference: creator.username,
      transactionDesc: `Support ${creator.displayName}`
    });

    // Create pending transaction in DB
    await (prisma.paymentTransaction as any).create({
      data: {
        creatorId,
        type: 'TIP',
        grossAmount,
        nexoraFee,
        netAmount,
        fanName,
        fanMessage,
        gateway: 'MPESA',
        gatewayReference: darajaData.CheckoutRequestID,
        status: 'PENDING'
      }
    });

    res.json({
      message: 'STK Push initiated',
      checkoutRequestId: darajaData.CheckoutRequestID,
      customerMessage: darajaData.customerMessage
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const validated = cardPaymentSchema.parse(req.body);
    const { creatorId, amount, email, fanName, fanMessage } = validated;

    const creator = await prisma.creatorProfile.findUnique({ where: { id: creatorId } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const nexoraFee = amount * 0.05; // 5% fee for international card tips
    const grossAmount = amount + nexoraFee;
    const netAmount = amount;

    const reference = `NC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required for card payments.' });
    }

    const paystackData = await initializeTransaction({
      email,
      amount: Math.round(grossAmount * 100), // Paystack takes kobo/cents
      currency: 'KES',
      reference,
      ...(creator.paystackSubaccountCode ? {
        subaccount: creator.paystackSubaccountCode,
        bearer: 'subaccount'
      } : {}),
      metadata: {
        fanName,
        fanMessage,
        creatorId
      }
    });

    // Create pending transaction in DB
    await (prisma.paymentTransaction as any).create({
      data: {
        creatorId,
        type: 'TIP',
        grossAmount,
        nexoraFee,
        netAmount,
        fanName,
        fanMessage,
        gateway: 'PAYSTACK',
        gatewayReference: paystackData.data.reference,
        status: 'PENDING'
      }
    });

    res.json(paystackData.data);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(JSON.stringify(req.body)).digest('hex');
  
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
    const { reference } = event.data;
    try {
      const transaction = await (prisma.paymentTransaction as any).update({
        where: { gatewayReference: reference },
        data: { status: 'COMPLETED' }
      });
      
      // Create notification
      await (prisma as any).notification.create({
        data: {
          creatorId: transaction.creatorId,
          type: 'SUCCESS',
          title: 'New Card Support! ☕',
          message: `${transaction.fanName || 'Someone'} bought you chais worth KES ${transaction.netAmount.toLocaleString()}`
        }
      });

      console.log(`✅ Paystack Payment success: ${reference}`);
    } catch (err) {
      console.error(`❌ Webhook Success Update Error:`, err);
    }
  } else if (event.event === 'charge.failed') {
    const { reference } = event.data;
    try {
      await (prisma.paymentTransaction as any).update({
        where: { gatewayReference: reference },
        data: { status: 'FAILED' }
      });
      console.log(`❌ Paystack Payment failed: ${reference}`);
    } catch (err) {
      console.error(`❌ Webhook Failure Update Error:`, err);
    }
  }

  res.sendStatus(200);
};

export const handleMpesaCallback = async (req: Request, res: Response) => {
  console.log('--- Received Daraja Callback ---');
  
  // Security Check: Verify secret token
  const { token } = req.query;
  if (token !== process.env.WEBHOOK_SECRET) {
      console.error('❌ Unauthorized M-Pesa callback attempt');
      return res.status(401).json({ error: 'Unauthorized' });
  }

  const { Body } = req.body;
  if (!Body || !Body.stkCallback) {
    return res.status(400).json({ error: 'Invalid callback data' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc } = Body.stkCallback;

  try {
    const status = ResultCode === 0 ? 'COMPLETED' : 'FAILED';
    
    if (status === 'COMPLETED') {
        // Atomic update: Mark as completed AND increment wallet balance
        // Idempotency: Only update if status is PENDING
        try {
            await prisma.$transaction(async (tx: any) => {
                const transaction = await tx.paymentTransaction.findUnique({
                    where: { gatewayReference: CheckoutRequestID }
                });

                if (!transaction || transaction.status !== 'PENDING') {
                    throw new Error('Transaction already processed or not found');
                }

                await tx.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'COMPLETED' }
                });

            // For M-Pesa tips, we increment the creator's wallet
            await tx.creatorWallet.upsert({
                where: { creatorId: transaction.creatorId },
                update: { balance: { increment: transaction.netAmount } },
                create: { creatorId: transaction.creatorId, balance: transaction.netAmount }
            });

            // Create notification
            await tx.notification.create({
                data: {
                    creatorId: transaction.creatorId,
                    type: 'SUCCESS',
                    title: 'New M-Pesa Support! ☕',
                    message: `${transaction.fanName || 'Someone'} sent you KES ${transaction.netAmount.toLocaleString()} via M-Pesa.`
                }
            });
        });
        console.log(`✅ M-Pesa Tip Success: ${CheckoutRequestID} -> Wallet Updated & Notified`);
    } else {
        await (prisma.paymentTransaction as any).update({
            where: { gatewayReference: CheckoutRequestID },
            data: { status: 'FAILED' }
        });
        console.log(`❌ M-Pesa Tip Failed: ${CheckoutRequestID}`);
    }
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (err: any) {
    console.error(`❌ M-Pesa Callback Error:`, err.message);
    res.status(500).json({ error: 'Database update failed' });
  }
};

export const checkStatus = async (req: Request, res: Response) => {
    const { reference } = req.params;
    try {
        const transaction = await (prisma.paymentTransaction as any).findUnique({
            where: { gatewayReference: reference }
        });
        
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        
        res.json({ status: transaction.status });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
