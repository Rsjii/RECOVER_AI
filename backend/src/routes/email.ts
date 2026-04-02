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
import { requireActiveSubscription } from '../middleware/subscriptionGate';
import { checkTrialStatus, requireNotTrial } from '../middleware/trialGating';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// Public endpoints (no auth)
router.post('/webhook/resend', resendWebhook);
router.get('/track/open', trackEmailOpen);
router.get('/track/click', trackEmailClick);

// All other routes require auth
router.use(authMiddleware);
router.use(checkTrialStatus);
router.use(demoBlocker);

// Schedule dunning emails for an invoice
router.post('/schedule', requireActiveSubscription, requireNotTrial, scheduleInvoiceEmails);

// Send a dunning email immediately
router.post('/send-now', requireActiveSubscription, requireNotTrial, sendEmailNow);

// Get email logs
router.get('/logs', getEmailLogs);

// Queue stats
router.get('/queue/stats', getQueueStats);

// Preview email content
router.get('/preview', authMiddleware, demoBlocker, previewEmail);

export default router;
