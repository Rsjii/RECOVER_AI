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
// DEPRECATED: Use /connect instead (which accepts both API key and webhook secret)
router.post('/validate-key', authMiddleware, demoBlocker, async (req, res) => {
  const { apiKey, webhookSecret } = req.body;
  const companyId = (req as any).companyId;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  // Validate format (sk_live_ or sk_test_)
  if (!apiKey.match(/^sk_(live|test)_[a-zA-Z0-9]+$/)) {
    return res.status(400).json({ error: 'Invalid Stripe API key format' });
  }

  // Validate webhook secret if provided
  if (webhookSecret && !webhookSecret.match(/^whsec_/)) {
    return res.status(400).json({ error: 'Invalid webhook secret format (must start with whsec_)' });
  }

  try {
    // SAVE both key and secret to company record (encrypted)
    const encrypted = encryptField(apiKey);
    const secretEncrypted = webhookSecret ? encryptField(webhookSecret) : null;

    await CompanyDB.updateCompany(companyId, {
      stripe_api_key_encrypted: encrypted,
      ...(secretEncrypted && { stripe_webhook_secret_encrypted: secretEncrypted })
    });

    return res.json({
      success: true,
      message: 'API key validated and saved',
      webhookSecretSaved: !!secretEncrypted
    });
  } catch (err: any) {
    // Don't leak error details to client
    return res.status(500).json({ error: 'Failed to save API key. Please try again.' });
  }
});

// Invoice endpoints
router.get('/invoices', authMiddleware, demoBlocker, listInvoices);
router.get('/invoices/:id', authMiddleware, demoBlocker, getInvoice);

export default router;
