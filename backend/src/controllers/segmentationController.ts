import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { listCustomersByTier, getCustomerTierDistribution, updateCustomerTier } from '../db/customers';
import { runSegmentationNow } from '../queue/segmentationJob';

const LOG_MODULE = 'segmentationController';

/**
 * GET /api/segmentation/by-tier
 * Returns customers grouped by risk tier (1-4).
 */
export const getCustomersByTier = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCustomersByTier';
  const companyId = (req as any).companyId;
  try {
    const groups = await listCustomersByTier(companyId);
    logInfo(LOG_MODULE, handler, 'Customers by tier fetched', { companyId });
    res.status(200).json({ data: groups });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to fetch customers by tier', code: 'SEGMENTATION_ERROR' });
  }
};

/**
 * GET /api/segmentation/distribution
 * Returns tier counts: { 1: N, 2: N, 3: N, 4: N }.
 */
export const getTierDistribution = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getTierDistribution';
  const companyId = (req as any).companyId;
  try {
    const distribution = await getCustomerTierDistribution(companyId);
    logInfo(LOG_MODULE, handler, 'Tier distribution fetched', { companyId });
    res.status(200).json({ data: distribution });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to fetch tier distribution', code: 'TIER_DISTRIBUTION_ERROR' });
  }
};

/**
 * PATCH /api/segmentation/customers/:id/tier
 * Manual tier override for a customer (admin/support use).
 */
export const overrideCustomerTier = async (req: Request, res: Response): Promise<void> => {
  const handler = 'overrideCustomerTier';
  const companyId = (req as any).companyId;
  const id = req.params.id as string;
  const { tier } = req.body;

  if (!tier || ![1, 2, 3, 4].includes(Number(tier))) {
    res.status(400).json({ error: 'tier must be 1, 2, 3, or 4', code: 'INVALID_TIER' });
    return;
  }

  try {
    await updateCustomerTier(id, companyId, Number(tier), 'manual_override');
    logInfo(LOG_MODULE, handler, 'Tier overridden', { companyId, customerId: id, tier });
    res.status(200).json({ data: { customerId: id, tier: Number(tier) } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to override tier', code: 'TIER_OVERRIDE_ERROR' });
  }
};

/**
 * POST /api/segmentation/run
 * Manually trigger a segmentation run (admin use).
 */
export const triggerSegmentation = async (req: Request, res: Response): Promise<void> => {
  const handler = 'triggerSegmentation';
  const companyId = (req as any).companyId;
  try {
    logInfo(LOG_MODULE, handler, 'Manual segmentation triggered', { companyId });
    const result = await runSegmentationNow();
    res.status(200).json({ data: result });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Segmentation run failed', code: 'SEGMENTATION_RUN_ERROR' });
  }
};
