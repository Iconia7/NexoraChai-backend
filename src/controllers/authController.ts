import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { sendSMS } from '../lib/africastalking';
import { sendPasswordResetEmail } from '../lib/emailService';
import { registerSchema, loginSchema } from '../lib/schemas';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const normalizePhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        cleaned = '254' + cleaned;
    }
    return '+' + cleaned;
};

export const resendOTP = async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.isVerified) return res.status(400).json({ error: 'Account already verified' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { otp, otpExpires }
        });

        if (phoneNumber) {
            const formattedPhone = normalizePhoneNumber(phoneNumber);
            await sendSMS(formattedPhone, `Welcome to Nexora Chai! Your One Time Password (OTP) Verification code is: ${otp}. It expires in 10 minutes.`);
        }

        res.json({ success: true, message: 'OTP resent successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const validated = registerSchema.parse(req.body);
        const { email, password, phoneNumber } = validated;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                otp,
                otpExpires,
                isVerified: false
            },
        });

        // Send OTP via SMS
        if (phoneNumber) {
            try {
                const formattedPhone = normalizePhoneNumber(phoneNumber);
                await sendSMS(formattedPhone, `Welcome to Nexora Chai! Your One Time Password (OTP) Verification code is: ${otp}. It expires in 10 minutes.`);
            } catch (smsError) {
                console.error('Failed to send registration OTP:', smsError);
            }
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            message: 'Registration successful. Please verify your account.',
            user: { id: user.id, email: user.email, isVerified: false },
            token
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        res.status(500).json({ error: error.message });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.isVerified) return res.status(400).json({ error: 'Account already verified' });

        if (user.otp !== otp || (user.otpExpires && user.otpExpires < new Date())) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, otp: null, otpExpires: null }
        });

        res.json({ success: true, message: 'Account verified successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const validated = loginSchema.parse(req.body);
        const { email, password } = validated;

        const user = await prisma.user.findUnique({ 
            where: { email }, 
            include: { profile: true } 
        });
        
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });

        if (!user.isVerified) {
            return res.status(403).json({ error: 'Please verify your account first', unverified: true });
        }

        // If 2FA enabled, stop here and return challenge
        if ((user as any).twoFactorEnabled) {
            return res.json({ requires2FA: true, userId: user.id });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: { id: user.id, email: user.email, profile: user.profile },
            token
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        res.status(500).json({ error: error.message });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: 'No account found with this email' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpires }
        });

        // Send reset email
        await sendPasswordResetEmail(email, resetToken);

        res.json({ success: true, message: 'Reset link sent to your email' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { resetToken: token }
        });

        if (!user || (user.resetTokenExpires && user.resetTokenExpires < new Date())) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpires: null
            }
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const verify2FALogin = async (req: Request, res: Response) => {
    const { userId, code } = req.body;
    try {
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { profile: true }
        });
        if (!user || !user.twoFactorSecret) return res.status(400).json({ error: 'Invalid request' });

        const isValid = authenticator.verify({
            token: code,
            secret: user.twoFactorSecret
        });

        if (!isValid) return res.status(400).json({ error: 'Invalid 2FA code' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            user: { id: user.id, email: user.email, profile: user.profile }, 
            token 
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
