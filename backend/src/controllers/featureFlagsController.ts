import { Request, Response } from 'express';
import * as FeatureFlagDB from '../db/featureFlags';
import * as AuditDB from '../db/auditLogs';
import { logError } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'featureFlagsController';

export const listFeatureFlags = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const flags = await FeatureFlagDB.listFeatureFlags(companyId);
    res.status(200).json({ data: flags });
  } catch (error) {
    logError(LOG_MODULE, 'listFeatureFlags', 'Failed to list flags', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const upsertFeatureFlag = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const { key, enabled, value } = req.body as { key?: string; enabled?: boolean; value?: Record<string, unknown> };
  if (!key || typeof enabled !== 'boolean') {
    sendErrorResponse(res, 400, 'key and enabled are required');
    return;
  }
  try {
    await FeatureFlagDB.upsertFeatureFlag(companyId, key, enabled, value);
    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'UPDATE',
      resourceType: 'feature_flag',
      resourceId: key,
      details: { enabled, value: value || {} },
    });
    res.status(200).json({ message: 'Feature flag updated' });
  } catch (error) {
    logError(LOG_MODULE, 'upsertFeatureFlag', 'Failed to update feature flag', error, { companyId, key });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};


