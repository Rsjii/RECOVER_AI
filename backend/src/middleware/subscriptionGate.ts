import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logInfo } from '../utils/logger';

const LOG_MODULE = 'subscriptionGate';

/**
 * Soft subscription gate — blocks action routes (email sends, agent triggers)
 * when subscription is past_due or canceled.
 * Returns 402 with upgrade URL so frontend can redirect to /billing.
 * GET routes and /api/billing/* are never gated.
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const companyId = (req as any).companyId as string | undefined;

  if (!companyId) {
    next();
    return;
  }

  try {
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM subscriptions WHERE company_id = $1 LIMIT 1',
      [companyId]
    );

    const sub = result.rows[0];

    if (!sub) {
      // No subscription row at all — still in grace (signup flow)
      next();
      return;
    }

    if (sub.status === 'past_due' || sub.status === 'canceled') {
      logInfo(LOG_MODULE, 'requireActiveSubscription', 'Blocking action — subscription not active', {
        companyId,
        status: sub.status,
      });
      res.status(402).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        status: sub.status,
        upgradeUrl: '/billing',
      });
      return;
    }

    next();
  } catch {
    // DB error — fail open (don't block the user if gate itself errors)
    next();
  }
};
