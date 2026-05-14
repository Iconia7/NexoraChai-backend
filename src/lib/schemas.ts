import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phoneNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Payment Schemas
export const mpesaPaymentSchema = z.object({
  creatorId: z.string().min(1, 'Creator ID is required'),
  amount: z.number().min(1, 'Minimum tip amount is KES 1').max(150000, 'Maximum M-Pesa tip is KES 150,000'),
  phoneNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number'),
  fanName: z.string().max(50).optional(),
  fanMessage: z.string().max(200).optional()
});

export const cardPaymentSchema = z.object({
  creatorId: z.string().min(1, 'Creator ID is required'),
  amount: z.number().min(50, 'Minimum card tip amount is KES 50').max(1000000, 'Maximum card tip is KES 1M'),
  email: z.string().email('Invalid email address'),
  fanName: z.string().max(50).optional(),
  fanMessage: z.string().max(200).optional()
});

// Withdrawal Schemas
export const withdrawalSchema = z.object({
  amount: z.number().min(100, 'Minimum withdrawal is KES 100').max(150000, 'Maximum single withdrawal is KES 150,000'),
  mpesaNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number')
});

// Settings Schemas
export const profileUpdateSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50),
  bio: z.string().max(300).optional(),
  category: z.string().optional(),
  avatarUrl: z.string().url().optional()
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

export const payoutUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Password is required for authorization'),
  mpesaNumber: z.string().regex(/^(?:\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number')
});
