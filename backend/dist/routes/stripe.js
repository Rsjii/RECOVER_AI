"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripeController_1 = require("../controllers/stripeController");
const invoiceController_1 = require("../controllers/invoiceController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const schemas_1 = require("../types/schemas");
const router = (0, express_1.Router)();
// Stripe webhook (raw body, no auth)
router.post('/webhook', stripeController_1.stripeWebhook);
// OAuth routes
router.get('/oauth/authorize', auth_1.authMiddleware, stripeController_1.stripeOAuthAuthorize);
router.get('/oauth/callback', stripeController_1.stripeOAuthCallback);
router.post('/oauth/exchange', auth_1.authMiddleware, stripeController_1.stripeOAuthExchange);
// Protected routes
router.post('/connect', auth_1.authMiddleware, (0, validate_1.validate)(schemas_1.connectStripeSchema), stripeController_1.connectStripe);
router.post('/sync', auth_1.authMiddleware, stripeController_1.syncInvoices);
// Invoice endpoints
router.get('/invoices', auth_1.authMiddleware, invoiceController_1.listInvoices);
router.get('/invoices/:id', auth_1.authMiddleware, invoiceController_1.getInvoice);
exports.default = router;
