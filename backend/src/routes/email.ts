import { Router } from 'express';
import {
  scheduleInvoiceEmails,
  sendEmailNow,
  getEmailLogs,
  getQueueStats,
  resendWebhook,
  previewEmail,
  trackEmailOpen,
  trackEmailClick,
} from '../controllers/emailController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public endpoints (no auth)
router.post('/webhook/resend', resendWebhook);
router.get('/track/open', trackEmailOpen);
router.get('/track/click', trackEmailClick);

// All other routes require auth
router.use(authMiddleware);

// Schedule dunning emails for an invoice
router.post('/schedule', scheduleInvoiceEmails);

// Send a dunning email immediately
router.post('/send-now', sendEmailNow);

// Get email logs
router.get('/logs', getEmailLogs);

// Queue stats
router.get('/queue/stats', getQueueStats);

// Preview email content
router.get('/preview', authMiddleware, previewEmail);

export default router;
