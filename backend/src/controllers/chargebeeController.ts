import { Request, Response } from 'express';
import { chargebeeService } from '../services/chargebeeService';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'chargebeeController';

export const connectChargebee = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;
    const { site, apiKey } = req.body;

    if (!site || !apiKey) {
      return sendErrorResponse(res, 400, 'site and apiKey are required');
    }

    await chargebeeService.connect(companyId, userId, site.trim(), apiKey.trim());
    return res.status(200).json({ message: 'Chargebee connected successfully' });
  } catch (err: any) {
    logError(LOG_MODULE, 'connectChargebee', 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const syncChargebeeInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    logInfo(LOG_MODULE, 'syncChargebeeInvoices', 'Manual sync requested', { companyId });
    const result = await chargebeeService.syncInvoices(companyId);
    return res.status(200).json({ message: 'Chargebee sync complete', result });
  } catch (err: any) {
    logError(LOG_MODULE, 'syncChargebeeInvoices', 'Sync failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const chargebeeWebhook = async (req: Request, res: Response) => {
  try {
    const { event_type, content, customer } = req.body;
    if (!event_type) return res.status(200).json({ received: true });

    // Find company by chargebee customer if possible — for now accept all and log
    // In production: verify webhook signature and resolve companyId from customer
    const companyId = req.query.companyId as string;
    if (companyId) {
      await chargebeeService.handleWebhook(companyId, event_type, content);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    logError(LOG_MODULE, 'chargebeeWebhook', 'Webhook failed', err);
    return res.status(200).json({ received: true }); // Always 200 to Chargebee
  }
};

export const disconnectChargebee = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;
    await chargebeeService.disconnect(companyId, userId);
    return res.status(200).json({ message: 'Chargebee disconnected' });
  } catch (err: any) {
    logError(LOG_MODULE, 'disconnectChargebee', 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};
