import { Router } from 'express';
import { setup2FA, verifyAndEnable2FA, disable2FA } from '../controllers/twoFactorController';
import { verify2FALogin } from '../controllers/authController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Public 2FA route (for login)
router.post('/verify-login', verify2FALogin);

// Protected 2FA routes (for setup/management)
router.post('/setup', authenticateToken, setup2FA);
router.post('/enable', authenticateToken, verifyAndEnable2FA);
router.post('/disable', authenticateToken, disable2FA);

export default router;
