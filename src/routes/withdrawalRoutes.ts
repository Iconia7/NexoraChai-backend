import { Router } from 'express';
import { requestWithdrawal } from '../controllers/withdrawalController';
import { authenticateToken } from '../middlewares/auth';
import { handleB2CResult, handleB2CTimeout } from '../controllers/webhookController';

const router = Router();

// Withdrawal Request
router.post('/mpesa', authenticateToken, requestWithdrawal);

// Daraja Webhooks
router.post('/webhooks/daraja/b2c-result', handleB2CResult);
router.post('/webhooks/daraja/b2c-timeout', handleB2CTimeout);

export default router;
