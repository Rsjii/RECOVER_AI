import { Request, Response, NextFunction } from 'express';
import { findCompanyById } from '../db/companies';
import { logWarn, logError } from '../utils/logger';

const LOG_MODULE = 'trialGating';

/**
 * Middleware to check trial status and attach to request
 * Does NOT block — just populates req.trialStatus and req.isTrialExpired
 */
export const checkTrialStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    return next();
  }

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      return next();
    }

    const now = new Date();
    const trialEndsAt = company.trial_ends_at ? new Date(company.trial_ends_at) : null;
    const isTrialExpired = trialEndsAt ? now > trialEndsAt : false;
    const isInTrial = company.onboarding_stage === 'trial_active' || company.trial_status === 'active';

    (req as any).trialStatus = company.trial_status || 'not_started';
    (req as any).isTrialExpired = isTrialExpired;
    (req as any).isInTrial = isInTrial;
    (req as any).trialEndsAt = trialEndsAt;
    (req as any).isPaid = company.onboarding_stage === 'paid_active';
  } catch (err) {
    logError(LOG_MODULE, 'checkTrialStatus', 'Failed to check trial status', err);
  }

  next();
};

/**
 * Middleware to block if trial has expired or user is still in trial
 * Only paid users (onboarding_stage = 'paid_active') can use paid features
 */
export const requireNotTrial = (req: Request, res: Response, next: NextFunction): void => {
  const companyId = (req as any).companyId;
  if (!companyId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const isPaid = (req as any).isPaid;
  const isInTrial = (req as any).isInTrial;
  const isTrialExpired = (req as any).isTrialExpired;

  // If paid, allow
  if (isPaid && !isTrialExpired) {
    next();
    return;
  }

  // If in trial and NOT expired, block
  if (isInTrial && !isTrialExpired) {
    res.status(403).json({
      error: 'This feature is only available on paid plans',
      action: 'upgrade',
      trialEndsAt: (req as any).trialEndsAt,
    });
    return;
  }

  // If trial expired, block
  if (isTrialExpired) {
    res.status(403).json({
      error: 'Your trial has expired. Please upgrade to continue using this feature.',
      action: 'upgrade',
      trialEndsAt: (req as any).trialEndsAt,
    });
    return;
  }

  // Default: allow (e.g., account_type = 'paid')
  next();
};