import { Request, Response } from 'express';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';

// Safe helper
const getAuthenticator = () => {
    const lib = otplib as any;
    return lib.authenticator || lib.default?.authenticator || (typeof lib.generateSecret === 'function' ? lib : null);
};

export const setup2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const authenticator = getAuthenticator();
  console.log(`🔐 Initiating 2FA setup for user: ${userId}`);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.error('❌ 2FA Setup: User not found');
        return res.status(404).json({ error: 'User not found' });
    }

    if (!authenticator) {
        throw new Error('Authenticator library not loaded correctly');
    }

    // This part is working!
    const secret = (authenticator as any).generateSecret();
    
    // NATIVE FIX: Generate the otpauth URI manually to bypass library method issues
    const issuer = encodeURIComponent('Nexora Chai');
    const account = encodeURIComponent(user.email);
    const otpauth = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;
    
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Temporarily save the secret but don't enable it yet
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret }
    });

    console.log('✅ 2FA Setup initiated successfully');
    res.json({ qrCodeUrl, secret });
  } catch (error: any) {
    console.error('🔥 2FA Setup Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const verifyAndEnable2FA = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { code } = req.body;
  const authenticator = getAuthenticator();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: '2FA not set up' });

    if (!authenticator) throw new Error('Authenticator not loaded');

    const isValid = (authenticator as any).verify({
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
  const authenticator = getAuthenticator();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: '2FA is not enabled' });
    }

    if (!authenticator) throw new Error('Authenticator not loaded');

    const isValid = (authenticator as any).verify({
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
