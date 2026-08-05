import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import {
  getSettings,
  updateDunningSettings,
  updateSlackSettings,
  updateGeneralSettings,
  updatePilotMode,  // P0
  updateManualMode,  // P0
  getApiCosts,
  updateDunningTone,
  updatePauseDunning,
  updatePauseCustomer,
  updateAggressiveMode,
  updateSmtpFallback,
  getDunningSenderName,
  updateDunningSenderName,
  disconnectStripe,
  disconnectQuickBooks,
  getEmailMode,      // P0: Email queue mode
  switchEmailMode,   // P0: Email queue mode switching
  getSMSSettings,
  updateSMSSettings,
  getTwilioConfig,
  configureTwilio,
  testTwilio,
  disconnectTwilio,
  updateSMSEscalation,
  updateSMSRetry,
  updateSMSCompliance,
  getSMSOptOuts,
  reOptInSMS,
} from '../controllers/settingsController';
import {
  getSMTPStatusHandler,
  getSMTPConfigHandler,
  configureSmtpHandler,
  testSmtpHandler,
  disableSmtpHandler,
} from '../controllers/smtpController';
import {
  getNotificationPreferencesHandler,
  updateNotificationPreferencesHandler,
} from '../controllers/notificationPreferencesController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);  // Block mutations for demo users (after auth is set)

router.get('/', getSettings);
router.get('/costs', getApiCosts);
router.get('/email-mode', getEmailMode);  // P0: Get current email mode
router.post('/email-mode', requireRole('admin'), switchEmailMode);  // P0: Switch email mode
router.put('/dunning', requireRole('admin'), updateDunningSettings);
router.put('/slack', requireRole('admin'), updateSlackSettings);
router.put('/general', requireRole('admin'), updateGeneralSettings);
router.put('/pilot-mode', requireRole('admin'), updatePilotMode);  // P0
router.patch('/manual-mode', requireRole('admin'), updateManualMode);  // P0

// Phase 2: Dunning strategy controls (via Slack bot)
router.put('/dunning-tone', requireRole('admin'), updateDunningTone);
router.put('/pause-dunning', requireRole('admin'), updatePauseDunning);
router.put('/pause-customer', requireRole('admin'), updatePauseCustomer);
router.put('/aggressive-mode', requireRole('admin'), updateAggressiveMode);
router.put('/smtp-fallback', requireRole('admin'), updateSmtpFallback);
router.get('/dunning-sender-name', getDunningSenderName);
router.put('/dunning-sender-name', requireRole('admin'), updateDunningSenderName);

// SMTP Configuration (Option A: client's own email server)
router.get('/smtp/status', getSMTPStatusHandler);
router.get('/smtp/config', requireRole('admin'), getSMTPConfigHandler);
router.post('/smtp/configure', requireRole('admin'), configureSmtpHandler);
router.post('/smtp/test', requireRole('admin'), testSmtpHandler);
router.post('/smtp/disable', requireRole('admin'), disableSmtpHandler);

// SMS Settings
router.get('/sms', getSMSSettings);
router.patch('/sms', requireRole('admin'), updateSMSSettings);
// NEW: SMS escalation, retry, compliance
router.patch('/sms/escalation', requireRole('admin'), updateSMSEscalation);
router.patch('/sms/retry', requireRole('admin'), updateSMSRetry);
router.patch('/sms/compliance', requireRole('admin'), updateSMSCompliance);
router.get('/sms/opt-outs', getSMSOptOuts);
router.post('/sms/opt-outs/:customerId/re-enable', requireRole('admin'), reOptInSMS);

// Twilio SMS Configuration (Customer's own account)
router.get('/twilio', getTwilioConfig);
router.post('/twilio/configure', requireRole('admin'), configureTwilio);
router.post('/twilio/test', requireRole('admin'), testTwilio);
router.post('/twilio/disconnect', requireRole('admin'), disconnectTwilio);

// Integrations disconnect endpoints
router.post('/integrations/stripe/disconnect', requireRole('admin'), disconnectStripe);
router.post('/integrations/quickbooks/disconnect', requireRole('admin'), disconnectQuickBooks);

// Notification Preferences
router.get('/notifications', getNotificationPreferencesHandler);
router.patch('/notifications', requireRole('admin'), updateNotificationPreferencesHandler);

export default router;
