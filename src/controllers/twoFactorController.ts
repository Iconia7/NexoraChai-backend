import { Request, Response } from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';

export const setup2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  console.log(`🔐 Initiating 2FA setup for user: ${userId}`);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.error('❌ 2FA Setup: User not found');
        return res.status(404).json({ error: 'User not found' });
    }

    // Defensive check for authenticator
    if (!authenticator || typeof authenticator.generateSecret !== 'function') {
        throw new Error('Authenticator library not loaded correctly');
    }

    const secret = authenticator.generateSecret();
    
    // Support both keyuri and keyURI just in case
    const keyuriMethod = (authenticator as any).keyuri || (authenticator as any).keyURI;
    if (typeof keyuriMethod !== 'function') {
        throw new Error('Authenticator.keyuri is not a function on this version');
    }

    const otpauth = keyuriMethod.call(authenticator, user.email, 'Nexora Chai', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Temporarily save the secret but don't enable it yet
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret }
    });

    console.log('✅ 2FA Secret generated and saved');
    res.json({ qrCodeUrl, secret });
  } catch (error: any) {
    console.error('🔥 2FA Setup Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const verifyAndEnable2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { code } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA not set up' });

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid verification code' });

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true }
    });

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const disable2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { code } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: '2FA is not enabled' });
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid verification code' });

    await prisma.user.update({
      where: { id: userId },
      data: { 
          twoFactorEnabled: false,
          twoFactorSecret: null 
      }
    });

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
