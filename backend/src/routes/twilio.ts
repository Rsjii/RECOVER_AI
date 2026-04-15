import { Router } from 'express';
import { handleSMSStatusWebhook } from '../controllers/twilioController';

const router = Router();

// Twilio SMS delivery status webhook (raw body, no auth required)
// POST /api/twilio/webhook/sms-status
router.post('/webhook/sms-status', handleSMSStatusWebhook);

export default router;
