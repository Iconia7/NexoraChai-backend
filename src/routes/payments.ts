import { Router } from 'express';
import { initializePayment, initializeMpesa, handleWebhook, handleMpesaCallback, checkStatus } from '../controllers/paymentController';

const router = Router();

router.post('/initialize', initializePayment);
router.post('/initialize-mpesa', initializeMpesa);
router.post('/webhook', handleWebhook);
router.post('/mpesa-callback', handleMpesaCallback);
router.get('/status/:reference', checkStatus);

export default router;
