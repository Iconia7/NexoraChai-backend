import { Router } from 'express';
import { initializePayment, initializeMpesa, handleWebhook, handleMpesaCallback, checkStatus } from '../controllers/paymentController';
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 payment initializations per hour
  message: { error: 'Payment initialization limit reached. Please try again later.' }
});

const router = Router();

router.post('/initialize', paymentLimiter, initializePayment);
router.post('/initialize-mpesa', paymentLimiter, initializeMpesa);
router.post('/webhook', handleWebhook);
router.post('/mpesa-callback', handleMpesaCallback);
router.get('/status/:reference', checkStatus);

export default router;
