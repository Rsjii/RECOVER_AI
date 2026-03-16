import { Request, Response } from 'express';
import { stripeService } from '../services/stripeService';
import { logError as baseLogError, logInfo as baseLogInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { getSyncHistory as getSyncHistoryDB } from '../db/integrationLogs';

// ============ Structured Logger ============
const LOG_MODULE = 'stripeController';

function logInfo(handler: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, handler, msg, data);
}

function logError(handler: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, handler, msg, error);
}

// ============ Handlers ============

export const connectStripe = async (req: Request, res: Response) => {
  const handler = 'connectStripe';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;

    logInfo(handler, 'Request received', { companyId, userId });

    await stripeService.connectStripe(companyId, userId, req.body);

    const elapsed = Date.now() - startTime;
    logInfo(handler, `Completed in ${elapsed}ms`, { companyId });

    return res.status(200).json({ message: 'Stripe connected successfully' });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    console.error('=== STRIPE CONNECT ERROR ===', { error: err.message, stack: err.stack });
    return sendErrorResponse(res, statusCode, message);
  }
};

export const syncInvoices = async (req: Request, res: Response) => {
  const handler = 'syncInvoices';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    logInfo(handler, 'Request received', { companyId });

    const result = await stripeService.syncInvoices(companyId);

    const elapsed = Date.now() - startTime;
    logInfo(handler, `Completed in ${elapsed}ms`, { companyId, ...result });

    return res.status(200).json({ message: 'Sync complete', result });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const handler = 'stripeWebhook';
  try {
    const signature = req.headers['stripe-signature'] as string;
    logInfo(handler, 'Webhook received', { hasSignature: !!signature });

    // Ensure body is a Buffer (express.raw() should provide this, but ensure it)
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    await stripeService.handleWebhook(rawBody, signature);

    logInfo(handler, 'Webhook processed successfully');
    return res.status(200).json({ received: true });
  } catch (err: any) {
    logError(handler, 'Webhook processing failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

// ============ OAuth Handlers ============

export const stripeOAuthAuthorize = async (req: Request, res: Response) => {
  const handler = 'stripeOAuthAuthorize';
  try {
    const companyId = (req as any).companyId;
    const { STRIPE_CLIENT_ID, BACKEND_URL } = process.env;

    logInfo(handler, 'Initiating OAuth', { companyId });

    if (!STRIPE_CLIENT_ID) {
      return sendErrorResponse(res, 500, 'STRIPE_CLIENT_ID not configured');
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
  } catch (err: any) {
    logError(handler, 'OAuth authorization failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/stripe/oauth/exchange
 * Frontend calls this after Stripe redirects to /stripe/oauth/callback with ?code=
 * Exchanges the code for an access token server-side.
 */
export const stripeOAuthExchange = async (req: Request, res: Response) => {
  const handler = 'stripeOAuthExchange';
  const startTime = Date.now();
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;
    const { code } = req.body as { code?: string };

    if (!code) {
      return sendErrorResponse(res, 400, 'code is required');
    }

    logInfo(handler, 'Exchanging OAuth code', { companyId });
    await stripeService.connectViaOAuth(companyId, userId, code);

    logInfo(handler, `OAuth exchange completed in ${Date.now() - startTime}ms`, { companyId });
    return res.status(200).json({ message: 'Stripe connected successfully' });
  } catch (err: any) {
    logError(handler, 'OAuth exchange failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const stripeOAuthCallback = async (req: Request, res: Response) => {
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
      return sendErrorResponse(res, 400, 'Missing code or state parameter');
    }

    const companyId = state as string;
    // In a real scenario, we would extract userId from a session/token
    // For now, we'll use a placeholder that should be resolved from the token
    const userId = (req as any).userId || 'system';

    logInfo(handler, 'Processing OAuth code', { companyId });

    await stripeService.connectViaOAuth(companyId, userId, code as string);

    const elapsed = Date.now() - startTime;
    logInfo(handler, `OAuth completed in ${elapsed}ms`, { companyId });

    return res.redirect(`${FRONTEND_URL}/setup/success?stripe=connected`);
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `OAuth callback failed after ${elapsed}ms`, err);
    const { FRONTEND_URL } = process.env;
    return res.redirect(`${FRONTEND_URL}/setup?error=stripe_connection_failed`);
  }
};

export const getSyncHistory = async (req: Request, res: Response) => {
  const handler = 'getSyncHistory';
  try {
    const companyId = (req as any).companyId;
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);

    logInfo(handler, 'Request received', { companyId, limit });

    const history = await getSyncHistoryDB(companyId, 'stripe', limit);

    return res.status(200).json({ data: history });
  } catch (err: any) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};
