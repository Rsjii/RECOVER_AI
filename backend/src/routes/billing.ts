import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  createMonthlyBillingInvoice,
  getCurrentSubscription,
  getEntitlements,
  getUsage,
  reconcileBillingState,
  listBillingInvoices,
  listPlans,
  recordUsage,
  syncRecoveredAmountToUsage,
  updateSubscription,
  createLemonSqueezyCheckout,
  handleLemonSqueezyWebhook,
  generateRazorpayInvoices,
  generateRazorpayInvoiceForCompany,
  handleRazorpayWebhook,
  setCompanyBillingTier,
} from '../controllers/billingController';

const router = Router();

router.get('/plans', listPlans);

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.get('/subscription', getCurrentSubscription);
router.put('/subscription', requireRole('admin'), updateSubscription);
router.get('/invoices', listBillingInvoices);
router.post('/invoices/generate', requireRole('admin'), createMonthlyBillingInvoice);
router.get('/usage', getUsage);
router.post('/usage', requireRole('admin'), recordUsage);
router.post('/usage/sync-recovered', requireRole('admin'), syncRecoveredAmountToUsage);
router.post('/usage/reconcile', requireRole('admin'), reconcileBillingState);
router.get('/entitlements', getEntitlements);

// LemonSqueezy routes
router.post('/checkout', createLemonSqueezyCheckout);
router.post('/webhook/lemonsqueezy', handleLemonSqueezyWebhook);

// Razorpay routes
router.post('/razorpay/generate-invoices', requireRole('admin'), generateRazorpayInvoices);
router.post('/razorpay/generate-invoice/:companyId', requireRole('admin'), generateRazorpayInvoiceForCompany);
router.put('/razorpay/company/:companyId/tier', requireRole('admin'), setCompanyBillingTier);
// Webhook has no auth (Razorpay signature validates)
router.post('/razorpay/webhook', handleRazorpayWebhook);

export default router;


