import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendWelcomeEmail } from '../lib/emailService';
import { profileUpdateSchema, passwordChangeSchema, payoutUpdateSchema } from '../lib/schemas';

const prisma = new PrismaClient();

export const setupProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { username, displayName } = req.body;

  try {
    const profile = await prisma.creatorProfile.create({
      data: {
        userId,
        username,
        displayName,
        wallet: {
          create: { balance: 0 }
        }
      }
    });

    // Send welcome email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
        await sendWelcomeEmail(user.email, displayName);
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const checkUsernameAvailability = async (req: Request, res: Response) => {
  const { username } = req.params;
  try {
    const profile = await prisma.creatorProfile.findUnique({
      where: { username: (username as string).toLowerCase() }
    });
    res.json({ available: !profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listCreators = async (req: Request, res: Response) => {
  try {
    const creators = await (prisma.creatorProfile as any).findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        category: true,
        views: true,
        createdAt: true,
      },
      orderBy: { views: 'desc' },
      take: 24
    });
    res.json(creators);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  const { username } = req.params;

  try {
    const profile = await (prisma.creatorProfile as any).findUnique({
      where: { username },
      include: {
        wallet: true,
      }
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Increment views asynchronously
    (prisma.creatorProfile as any).update({
      where: { username },
      data: { views: { increment: 1 } }
    }).catch(console.error);

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { range } = req.query; // '7', '30', '90', 'all'

  let dateFilter = {};
  if (range && range !== 'all') {
    const days = parseInt(range as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    dateFilter = { createdAt: { gte: startDate } };
  }

  try {
    const profile = await (prisma.creatorProfile as any).findUnique({
      where: { userId },
      include: {
        wallet: true,
        user: true,
        transactions: {
          where: dateFilter,
          orderBy: { createdAt: 'desc' }
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const transactions = (profile as any).transactions || [];

    const totalEarnings = transactions
      .filter((t: any) => t.status === 'COMPLETED' && (t.type === 'TIP' || t.type === 'CARD'))
      .reduce((acc: number, t: any) => acc + (t.netAmount || 0), 0);

    const paystackTotal = transactions
      .filter((t: any) => t.status === 'COMPLETED' && t.gateway === 'PAYSTACK')
      .reduce((acc: number, t: any) => acc + (t.netAmount || 0), 0);

    // Calculate top supporters
    const supportersMap: Record<string, { name: string, total: number, count: number }> = {};
    transactions.forEach((t: any) => {
      if (t.type === 'TIP' && t.status === 'COMPLETED') {
        const name = t.fanName || 'A Supporter';
        if (!supportersMap[name]) supportersMap[name] = { name, total: 0, count: 0 };
        supportersMap[name].total += (t.netAmount || 0);
        supportersMap[name].count += 1;
      }
    });

    const topSupporters = Object.values(supportersMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        chais: s.count,
        value: `KES ${s.total.toLocaleString()}`
      }));

    // Calculate support sources
    const sourcesMap: Record<string, number> = { 'Direct Link': 0, 'Twitter / X': 0, 'Instagram': 0 };
    let totalSourced = 0;
    transactions.forEach((t: any) => {
      if (t.type === 'TIP' && t.status === 'COMPLETED') {
        const src = (t as any).source || 'Direct Link';
        const normalizedSrc = src.toLowerCase().includes('twitter') ? 'Twitter / X' : 
                             src.toLowerCase().includes('instagram') ? 'Instagram' : 'Direct Link';
        sourcesMap[normalizedSrc] = (sourcesMap[normalizedSrc] || 0) + 1;
        totalSourced++;
      }
    });

    const supportSources = Object.entries(sourcesMap).map(([label, count]) => ({
      label,
      percentage: totalSourced > 0 ? Math.round((count / totalSourced) * 100) : (label === 'Direct Link' ? 100 : 0),
      color: label === 'Twitter / X' ? 'bg-blue-400' : label === 'Instagram' ? 'bg-pink-400' : 'bg-brand-primary'
    }));

    // Calculate monthly growth (always last 12 months, independent of filter)
    const allTransactions = await (prisma.paymentTransaction as any).findMany({
      where: { creatorId: profile.id, status: 'COMPLETED', type: 'TIP' }
    });

    const monthlyGrowth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const month = d.getMonth();
      const year = d.getFullYear();
      
      const monthTotal = allTransactions
        .filter((t: any) => {
          const td = new Date(t.createdAt);
          return td.getMonth() === month && td.getFullYear() === year;
        })
        .reduce((acc: number, t: any) => acc + (t.netAmount || 0), 0);
      
      return monthTotal;
    });

    res.json({
      profile: {
        ...profile,
        avatarUrl: (profile as any).avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
      },
      wallet: profile.wallet,
      paystackTotal,
      user: {
          email: profile.user.email,
          twoFactorEnabled: (profile.user as any).twoFactorEnabled
      },
      transactions: transactions.slice(0, 10),
      totalEarnings,
      stats: {
        totalChais: transactions.filter((t: any) => t.type === 'TIP' && t.status === 'COMPLETED').length,
        views: (profile as any).views || 0,
        conversion: (profile as any).views > 0 ? Math.round((transactions.filter((t: any) => t.type === 'TIP' && t.status === 'COMPLETED').length / (profile as any).views) * 100) : 0
      },
      topSupporters,
      supportSources,
      monthlyGrowth,
      notifications: (profile as any).notifications?.slice(0, 5) || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  
  try {
    const validated = profileUpdateSchema.parse(req.body);
    const { displayName, bio, avatarUrl, category } = validated;

    const profile = await (prisma.creatorProfile as any).update({
      where: { userId },
      data: { displayName, bio, avatarUrl, category }
    });
    res.json(profile);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const incrementViews = async (req: Request, res: Response) => {
    const { username } = req.params;
    try {
        await (prisma.creatorProfile as any).update({
            where: { username },
            data: { views: { increment: 1 } }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    try {
        const validated = passwordChangeSchema.parse(req.body);
        const { currentPassword, newPassword } = validated;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message });
        }
        res.status(500).json({ error: error.message });
    }
};

export const updatePayoutNumber = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    try {
        const validated = payoutUpdateSchema.parse(req.body);
        const { currentPassword, mpesaNumber } = validated;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

        await prisma.creatorProfile.update({
            where: { userId },
            data: { mpesaNumber }
        });
        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues[0].message });
        }
        res.status(500).json({ error: error.message });
    }
};

export const getNotifications = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    try {
        const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const notifications = await (prisma as any).notification.findMany({
            where: { creatorId: profile.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const markNotificationAsRead = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await (prisma as any).notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
