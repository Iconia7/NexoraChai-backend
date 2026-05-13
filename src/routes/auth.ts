import { Router } from 'express';
import { register, login, verifyOTP, forgotPassword, resetPassword, resendOTP } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/resend-otp', resendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
