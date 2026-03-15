import { Router } from 'express';
import { connectStripe, syncInvoices, stripeWebhook, stripeOAuthAuthorize, stripeOAuthCallback, stripeOAuthExchange } from '../controllers/stripeController';
import { listInvoices, getInvoice } from '../controllers/invoiceController';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { connectStripeSchema } from '../types/schemas';

const router = Router();

// Stripe webhook (raw body, no auth)
router.post('/webhook', stripeWebhook);

// OAuth routes
router.get('/oauth/authorize', authMiddleware, stripeOAuthAuthorize);
router.get('/oauth/callback', stripeOAuthCallback);
router.post('/oauth/exchange', authMiddleware, stripeOAuthExchange);

// Protected routes
router.post('/connect', authMiddleware, validate(connectStripeSchema), connectStripe);
router.post('/sync', authMiddleware, syncInvoices);

// Invoice endpoints
router.get('/invoices', authMiddleware, listInvoices);
router.get('/invoices/:id', authMiddleware, getInvoice);

export default router;
