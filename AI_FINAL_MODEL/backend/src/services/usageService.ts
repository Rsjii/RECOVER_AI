import { db } from '../config/db';
import { getPlan } from '../config/plans';

export const usageService = {
  async checkLimit(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subRes = await db.query(`SELECT tier FROM subscriptions WHERE org_id = $1`, [orgId]);
    const tier = subRes.rows[0]?.tier || 'free';
    const plan = getPlan(tier);

    if (plan.maxPRsPerMonth === Infinity) return { allowed: true };

    const month = new Date().toISOString().slice(0, 7);
    const usageRes = await db.query(
      `SELECT prs_analyzed FROM usage WHERE org_id = $1 AND month = $2`,
      [orgId, month]
    );
    const used = usageRes.rows[0]?.prs_analyzed || 0;

    if (used >= plan.maxPRsPerMonth) {
      return { allowed: false, reason: `Monthly limit of ${plan.maxPRsPerMonth} PRs reached` };
    }

    return { allowed: true };
  },
};
