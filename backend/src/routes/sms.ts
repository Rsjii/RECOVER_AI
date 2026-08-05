import { Router } from 'express';
import { sendSMSNow } from '../controllers/smsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /api/sms/send-now
 * Send SMS immediately for an invoice (manual trigger)
 * Requires: Authentication + invoiceId in body
 */
router.post('/send-now', authMiddleware, sendSMSNow);

export default router;
