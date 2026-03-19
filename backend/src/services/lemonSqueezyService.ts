import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';
import { config } from '../config/env';
import crypto from 'crypto';
import { upsertCompanySubscription, ensureDefaultPlans } from '../db/billing';

export class LemonSqueezyService {
  private apiKey = config.lemonSqueezy.apiKey;
  private storeId = config.lemonSqueezy.storeId;
  private webhookSecret = config.lemonSqueezy.webhookSecret;

  async createCheckout(params: {
    planId: 'phase_0' | 'growth' | 'enterprise';
    billingInterval?: 'monthly' | 'annual';
    customerEmail: string;
    customerName: string;
    companyId: string;
  }): Promise<{
    success: boolean;
    checkoutUrl?: string;
    error?: string;
  }> {
    try {
      const interval = params.billingInterval || 'monthly';
      logInfo('lemonSqueezyService', 'createCheckout', `Creating checkout`, {
        plan: params.planId,
        interval,
        email: params.customerEmail,
      });

      // Map plan + interval to variant IDs from config
      // New plans: growth ($2,500/mo) + enterprise ($5,000/mo)
      const variantMap: Record<string, Record<string, string>> = {
        phase_0: {
          monthly: config.lemonSqueezy.variantPhase0Monthly || '000001',
          annual: config.lemonSqueezy.variantPhase0Monthly || '000001',  // no annual for phase_0
        },
        growth: {
          monthly: config.lemonSqueezy.variantGrowthMonthly || '123458',
          annual: config.lemonSqueezy.variantGrowthAnnual || '123459',
        },
        enterprise: {
          monthly: config.lemonSqueezy.variantEnterpriseMonthly || '123460',
          annual: config.lemonSqueezy.variantEnterpriseAnnual || '123461',
        },
      };

      const variantId = variantMap[params.planId]?.[interval];
      if (!variantId) {
        throw new Error(`Unknown plan or interval: ${params.planId}/${interval}`);
      }

      const response = await fetch(
        'https://api.lemonsqueezy.com/v1/checkouts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.api+json',
          },
          body: JSON.stringify({
            data: {
              type: 'checkouts',
              attributes: {
                checkout_data: {
                  custom: {
                    company_id: params.companyId,
                    plan_code: params.planId,
                    billing_interval: interval,
                  },
                },
                checkout_options: {
                  redirect_url: `${config.frontendUrl}/billing/success`,
                },
              },
              relationships: {
                store: {
                  data: {
                    type: 'stores',
                    id: this.storeId,
                  },
                },
                variant: {
                  data: {
                    type: 'variants',
                    id: variantId,
                  },
                },
              },
            },
          }),
        }
      );

      const data = (await response.json()) as any;

      if (!response.ok || data.errors) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to create checkout');
      }

      const checkoutUrl = data.data?.attributes?.url;

      logInfo('lemonSqueezyService', 'createCheckout', '✅ Checkout created', {
        url: checkoutUrl,
      });

      return {
        success: true,
        checkoutUrl,
      };
    } catch (error) {
      logError('lemonSqueezyService', 'createCheckout', 'Error', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  verifyWebhookSignature(
    body: string,
    signature: string
  ): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', this.webhookSecret!)
        .update(body)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      logError('lemonSqueezyService', 'verifyWebhook', 'Error verifying', error);
      return false;
    }
  }

  private mapLsStatus(lsStatus: string): 'trialing' | 'active' | 'past_due' | 'canceled' {
    switch (lsStatus) {
      case 'active':
        return 'active';
      case 'trialing':
        return 'trialing';
      case 'past_due':
        return 'past_due';
      case 'cancelled':
      case 'expired':
      case 'paused':
        return 'past_due'; // treat paused/expired as payment issue
      default:
        return 'active';
    }
  }

  async handleWebhook(event: any): Promise<void> {
    try {
      const eventName = event.meta?.event_name;
      const data = event.data;

      logInfo('lemonSqueezyService', 'handleWebhook', `Event: ${eventName}`);

      // Ensure default plans exist
      await ensureDefaultPlans();

      if (eventName === 'subscription_created') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;
        const planCode = customData?.plan_code || 'growth';
        const customerId = data.attributes?.customer_id;
        const lsStatus = data.attributes?.status;
        const lsSubscriptionId = data.id;

        if (companyId) {
          const status = this.mapLsStatus(lsStatus);

          // Update subscriptions table
          await upsertCompanySubscription({
            companyId,
            planCode,
            status,
          });

          // Also update companies table with LS customer ID
          await pool.query(
            `UPDATE companies
             SET lemon_squeezy_customer_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [customerId, companyId]
          );

          logInfo('lemonSqueezyService', 'handleWebhook', '✅ Subscription created', {
            companyId,
            planCode,
            status,
          });
        }
      }

      if (eventName === 'subscription_updated') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;
        const planCode = customData?.plan_code || 'growth';
        const lsStatus = data.attributes?.status;

        if (companyId) {
          const status = this.mapLsStatus(lsStatus);

          await upsertCompanySubscription({
            companyId,
            planCode,
            status,
          });

          logInfo('lemonSqueezyService', 'handleWebhook', '✅ Subscription updated', {
            companyId,
            planCode,
            status,
          });
        }
      }

      if (eventName === 'subscription_cancelled') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;
        const planCode = customData?.plan_code || 'growth';

        if (companyId) {
          await upsertCompanySubscription({
            companyId,
            planCode,
            status: 'canceled',
          });

          logInfo('lemonSqueezyService', 'handleWebhook', '✅ Subscription cancelled', {
            companyId,
          });
        }
      }
    } catch (error) {
      logError('lemonSqueezyService', 'handleWebhook', 'Error processing webhook', error);
    }
  }
}

export default new LemonSqueezyService();
