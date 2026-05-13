import { Request, Response } from 'express';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';

export const setup2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = otplib.authenticator.generateSecret();
    const otpauth = otplib.authenticator.keyuri(user.email, 'Nexora Chai', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Temporarily save the secret but don't enable it yet
    await (prisma.user as any).update({
      where: { id: userId },
      data: { twoFactorSecret: secret }
    });

    res.json({ qrCodeUrl, secret });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyAndEnable2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { code } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA not set up' });

    const isValid = otplib.authenticator.verify({
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

    const isValid = otplib.authenticator.verify({
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
