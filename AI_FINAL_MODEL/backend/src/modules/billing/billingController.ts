import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { db } from '../../config/db';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { AuthRequest } from '../../types';
import { PLANS } from '../../config/plans';
import { logActivity } from '../../lib/activity';

export const getPlan = async (req: AuthRequest, res: Response) => {
  const subRes = await db.query(`SELECT * FROM subscriptions WHERE org_id = $1`, [req.orgId]);
  const sub = subRes.rows[0] || { tier: 'free', status: 'active' };

  const month = new Date().toISOString().slice(0, 7);
  const usageRes = await db.query(
    `SELECT prs_analyzed FROM usage WHERE org_id = $1 AND month = $2`,
    [req.orgId, month]
  );
  const prsAnalyzed = usageRes.rows[0]?.prs_analyzed || 0;
  const plan = PLANS[sub.tier as keyof typeof PLANS] || PLANS.free;

  res.json({ subscription: sub, usage: { prs_analyzed: prsAnalyzed, max: plan.maxPRsPerMonth }, plan });
};

export const getCheckoutUrls = async (req: AuthRequest, res: Response) => {
  const redirectUrl = encodeURIComponent(`${config.frontendUrl}/dashboard`);
  const withParams = (url: string | undefined) => {
    if (!url) return null;
    let result = `${url}?checkout[redirect_url]=${redirectUrl}`;
    if (req.orgId) result += `&checkout[custom][org_id]=${req.orgId}`;
    return result;
  };

  res.json({
    starter:      withParams(process.env['LS_STARTER_CHECKOUT_URL']),
    professional: withParams(process.env['LS_PROFESSIONAL_CHECKOUT_URL']),
    enterprise:   withParams(process.env['LS_ENTERPRISE_CHECKOUT_URL']),
  });
};

export const getPortalUrl = async (req: AuthRequest, res: Response) => {
  const subRes = await db.query(
    `SELECT lemonsqueezy_customer_id FROM subscriptions WHERE org_id = $1`,
    [req.orgId]
  );
  const customerId = subRes.rows[0]?.lemonsqueezy_customer_id;

  if (!customerId) return res.json({ url: 'https://app.lemonsqueezy.com' });

  try {
    const lsRes = await axios.get(`https://api.lemonsqueezy.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${config.lemonSqueezy.apiKey}` },
    });
    res.json({
      url: lsRes.data.data?.attributes?.urls?.customer_portal || 'https://app.lemonsqueezy.com',
    });
  } catch {
    res.json({ url: 'https://app.lemonsqueezy.com' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const secret = config.lemonSqueezy.webhookSecret;
  const signature = req.headers['x-signature'] as string;

  if (secret && signature) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(req.body).digest('hex');
    if (digest !== signature) return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString());
  const eventName = payload.meta?.event_name;
  const attrs = payload.data?.attributes;

  logger.info(`[Billing] LS event: ${eventName}`);

  try {
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const customerId = String(attrs.customer_id);
      const subscriptionId = String(payload.data.id);
      const status =
        attrs.status === 'active' ? 'active' :
        attrs.status === 'cancelled' ? 'cancelled' : 'past_due';
      const variantId = String(attrs.variant_id);

      const VARIANT_TO_TIER: Record<string, string> = {
        [process.env['LS_STARTER_VARIANT_ID']      || '']: 'starter',
        [process.env['LS_PROFESSIONAL_VARIANT_ID'] || '']: 'professional',
        [process.env['LS_ENTERPRISE_VARIANT_ID']   || '']: 'enterprise',
      };
      const tier = VARIANT_TO_TIER[variantId] || 'starter';

      // Prefer org_id from custom checkout data; fall back to email lookup
      let orgId: string | null = payload.meta?.custom_data?.org_id || null;
      if (!orgId) {
        const email = attrs.user_email;
        const userRes = await db.query(`SELECT org_id FROM users WHERE email = $1`, [email]);
        orgId = userRes.rows[0]?.org_id || null;
      }

      if (orgId) {
        await db.query(
          `INSERT INTO subscriptions
             (org_id, tier, status, lemonsqueezy_subscription_id, lemonsqueezy_customer_id, current_period_end, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())
           ON CONFLICT (org_id) DO UPDATE SET
             tier = $2, status = $3,
             lemonsqueezy_subscription_id = $4,
             lemonsqueezy_customer_id = $5,
             current_period_end = $6,
             updated_at = NOW()`,
          [orgId, tier, status, subscriptionId, customerId, attrs.renews_at || null]
        );
        await logActivity(orgId, null, 'plan_changed', `Plan changed to ${tier}`);
      }
    }

    if (eventName === 'subscription_expired' || eventName === 'subscription_cancelled') {
      const subscriptionId = String(payload.data.id);
      await db.query(
        `UPDATE subscriptions SET status = 'cancelled', tier = 'free', updated_at = NOW()
         WHERE lemonsqueezy_subscription_id = $1`,
        [subscriptionId]
      );
    }
  } catch (err: any) {
    logger.error({ err }, '[Billing] Webhook processing error');
  }

  res.json({ received: true });
};
