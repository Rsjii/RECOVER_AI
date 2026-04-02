import { Router } from 'express';
import { connectStripe, syncInvoices, stripeWebhook, stripeOAuthAuthorize, stripeOAuthCallback, stripeOAuthExchange, getSyncHistory } from '../controllers/stripeController';
import { listInvoices, getInvoice } from '../controllers/invoiceController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';
import { validate } from '../middleware/validate';
import { connectStripeSchema } from '../types/schemas';
import * as CompanyDB from '../db/companies';
import { encryptField } from '../lib/encryption';

const router = Router();

// Stripe webhook (raw body, no auth)
router.post('/webhook', stripeWebhook);

// OAuth routes
router.get('/oauth/authorize', authMiddleware, demoBlocker, stripeOAuthAuthorize);
router.get('/oauth/callback', stripeOAuthCallback);
router.post('/oauth/exchange', authMiddleware, demoBlocker, stripeOAuthExchange);

// Protected routes
router.post('/connect', authMiddleware, demoBlocker, validate(connectStripeSchema), connectStripe);
router.post('/sync', authMiddleware, demoBlocker, syncInvoices);
router.get('/sync/history', authMiddleware, demoBlocker, getSyncHistory);

// Validate API key (for manual paste)
router.post('/validate-key', authMiddleware, demoBlocker, async (req, res) => {
  const { apiKey } = req.body;
  const companyId = (req as any).companyId;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  // Validate format (sk_live_ or sk_test_)
  if (!apiKey.match(/^sk_(live|test)_[a-zA-Z0-9]+$/)) {
    return res.status(400).json({ error: 'Invalid Stripe API key format' });
  }

  try {
    // SAVE the key to company record (encrypted)
    const encrypted = encryptField(apiKey);
    await CompanyDB.updateCompany(companyId, { stripe_api_key_encrypted: encrypted });

    return res.json({ success: true, message: 'API key validated and saved' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save API key', details: err.message });
  }
});

// Invoice endpoints
router.get('/invoices', authMiddleware, demoBlocker, listInvoices);
router.get('/invoices/:id', authMiddleware, demoBlocker, getInvoice);

export default router;
