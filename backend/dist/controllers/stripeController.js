"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeOAuthCallback = exports.stripeOAuthExchange = exports.stripeOAuthAuthorize = exports.stripeWebhook = exports.syncInvoices = exports.connectStripe = void 0;
const stripeService_1 = require("../services/stripeService");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
// ============ Structured Logger ============
const LOG_MODULE = 'stripeController';
function logInfo(handler, msg, data) {
    (0, logger_1.logInfo)(LOG_MODULE, handler, msg, data);
}
function logError(handler, msg, error) {
    (0, logger_1.logError)(LOG_MODULE, handler, msg, error);
}
// ============ Handlers ============
const connectStripe = async (req, res) => {
    const handler = 'connectStripe';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const userId = req.userId;
        logInfo(handler, 'Request received', { companyId, userId });
        if (!req.body.stripeApiKey) {
            logInfo(handler, 'Validation failed — missing stripeApiKey');
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'stripeApiKey is required');
        }
        await stripeService_1.stripeService.connectStripe(companyId, userId, req.body);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, { companyId });
        return res.status(200).json({ message: 'Stripe connected successfully' });
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.connectStripe = connectStripe;
const syncInvoices = async (req, res) => {
    const handler = 'syncInvoices';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        logInfo(handler, 'Request received', { companyId });
        const result = await stripeService_1.stripeService.syncInvoices(companyId);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, { companyId, ...result });
        return res.status(200).json({ message: 'Sync complete', result });
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.syncInvoices = syncInvoices;
const stripeWebhook = async (req, res) => {
    const handler = 'stripeWebhook';
    try {
        const signature = req.headers['stripe-signature'];
        logInfo(handler, 'Webhook received', { hasSignature: !!signature });
        // Ensure body is a Buffer (express.raw() should provide this, but ensure it)
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        await stripeService_1.stripeService.handleWebhook(rawBody, signature);
        logInfo(handler, 'Webhook processed successfully');
        return res.status(200).json({ received: true });
    }
    catch (err) {
        logError(handler, 'Webhook processing failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.stripeWebhook = stripeWebhook;
// ============ OAuth Handlers ============
const stripeOAuthAuthorize = async (req, res) => {
    const handler = 'stripeOAuthAuthorize';
    try {
        const companyId = req.companyId;
        const { STRIPE_CLIENT_ID, BACKEND_URL } = process.env;
        logInfo(handler, 'Initiating OAuth', { companyId });
        if (!STRIPE_CLIENT_ID) {
            return (0, errorHandler_1.sendErrorResponse)(res, 500, 'STRIPE_CLIENT_ID not configured');
        }
        const params = new URLSearchParams({
            client_id: STRIPE_CLIENT_ID,
            state: companyId,
            scope: 'read_write',
            redirect_uri: `${BACKEND_URL}/api/stripe/oauth/callback`,
        });
        const authUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
        logInfo(handler, 'Redirecting to Stripe OAuth', { companyId });
        return res.redirect(authUrl);
    }
    catch (err) {
        logError(handler, 'OAuth authorization failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.stripeOAuthAuthorize = stripeOAuthAuthorize;
/**
 * POST /api/stripe/oauth/exchange
 * Frontend calls this after Stripe redirects to /stripe/oauth/callback with ?code=
 * Exchanges the code for an access token server-side.
 */
const stripeOAuthExchange = async (req, res) => {
    const handler = 'stripeOAuthExchange';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const userId = req.userId;
        const { code } = req.body;
        if (!code) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'code is required');
        }
        logInfo(handler, 'Exchanging OAuth code', { companyId });
        await stripeService_1.stripeService.connectViaOAuth(companyId, userId, code);
        logInfo(handler, `OAuth exchange completed in ${Date.now() - startTime}ms`, { companyId });
        return res.status(200).json({ message: 'Stripe connected successfully' });
    }
    catch (err) {
        logError(handler, 'OAuth exchange failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.stripeOAuthExchange = stripeOAuthExchange;
const stripeOAuthCallback = async (req, res) => {
    const handler = 'stripeOAuthCallback';
    const startTime = Date.now();
    try {
        const { code, state, error } = req.query;
        const { FRONTEND_URL } = process.env;
        logInfo(handler, 'OAuth callback received', { hasCode: !!code, hasError: !!error });
        if (error) {
            logError(handler, 'OAuth error', { error });
            return res.redirect(`${FRONTEND_URL}/setup?error=${error}`);
        }
        if (!code || !state) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'Missing code or state parameter');
        }
        const companyId = state;
        // In a real scenario, we would extract userId from a session/token
        // For now, we'll use a placeholder that should be resolved from the token
        const userId = req.userId || 'system';
        logInfo(handler, 'Processing OAuth code', { companyId });
        await stripeService_1.stripeService.connectViaOAuth(companyId, userId, code);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `OAuth completed in ${elapsed}ms`, { companyId });
        return res.redirect(`${FRONTEND_URL}/setup/success?stripe=connected`);
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `OAuth callback failed after ${elapsed}ms`, err);
        const { FRONTEND_URL } = process.env;
        return res.redirect(`${FRONTEND_URL}/setup?error=stripe_connection_failed`);
    }
};
exports.stripeOAuthCallback = stripeOAuthCallback;
