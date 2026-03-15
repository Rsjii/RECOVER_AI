import { Request, Response } from 'express';
import { quickbooksService } from '../services/quickbooksService';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'quickbooksController';

export const qbOAuthAuthorize = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const redirectUri = `${process.env.BACKEND_URL}/api/quickbooks/oauth/callback`;
    const url = quickbooksService.getOAuthUrl(companyId, redirectUri);
    logInfo(LOG_MODULE, 'qbOAuthAuthorize', 'Redirecting to QB OAuth', { companyId });
    return res.redirect(url);
  } catch (err: any) {
    logError(LOG_MODULE, 'qbOAuthAuthorize', 'Failed', err);
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=qb_auth_failed`);
  }
};

export const qbOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, realmId, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL;

    if (error) {
      return res.redirect(`${frontendUrl}/settings?error=${error}`);
    }

    if (!code || !state || !realmId) {
      return res.redirect(`${frontendUrl}/settings?error=qb_missing_params`);
    }

    const companyId = state as string;
    const userId = (req as any).userId || 'system';
    const redirectUri = `${process.env.BACKEND_URL}/api/quickbooks/oauth/callback`;

    await quickbooksService.handleOAuthCallback(companyId, userId, code as string, realmId as string, redirectUri);

    return res.redirect(`${frontendUrl}/settings?qb=connected`);
  } catch (err: any) {
    logError(LOG_MODULE, 'qbOAuthCallback', 'Failed', err);
    return res.redirect(`${process.env.FRONTEND_URL}/settings?error=qb_connection_failed`);
  }
};

export const syncQBInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    logInfo(LOG_MODULE, 'syncQBInvoices', 'Manual sync requested', { companyId });
    const result = await quickbooksService.syncInvoices(companyId);
    return res.status(200).json({ message: 'QuickBooks sync complete', result });
  } catch (err: any) {
    logError(LOG_MODULE, 'syncQBInvoices', 'Sync failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const disconnectQB = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;
    await quickbooksService.disconnect(companyId, userId);
    return res.status(200).json({ message: 'QuickBooks disconnected' });
  } catch (err: any) {
    logError(LOG_MODULE, 'disconnectQB', 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};
