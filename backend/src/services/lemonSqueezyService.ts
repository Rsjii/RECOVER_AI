import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';
import { config } from '../config/env';
import crypto from 'crypto';

export class LemonSqueezyService {
  private apiKey = config.lemonSqueezy.apiKey;
  private storeId = config.lemonSqueezy.storeId;
  private webhookSecret = config.lemonSqueezy.webhookSecret;

  async createCheckout(params: {
    planId: 'starter' | 'growth' | 'enterprise';
    customerEmail: string;
    customerName: string;
    companyId: string;
  }): Promise<{
    success: boolean;
    checkoutUrl?: string;
    error?: string;
  }> {
    try {
      logInfo('lemonSqueezyService', 'createCheckout', `Creating checkout`, {
        plan: params.planId,
        email: params.customerEmail,
      });

      // Product IDs (you'll set these from Lemon Squeezy dashboard)
      const productIds: Record<string, string> = {
        starter: process.env.LS_PRODUCT_STARTER_ID || '123456',
        growth: process.env.LS_PRODUCT_GROWTH_ID || '123457',
        enterprise: process.env.LS_PRODUCT_ENTERPRISE_ID || '123458',
      };

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
                  },
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
                    id: productIds[params.planId],
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

  async handleWebhook(event: any): Promise<void> {
    try {
      const eventName = event.meta?.event_name;
      const data = event.data;

      logInfo('lemonSqueezyService', 'handleWebhook', `Event: ${eventName}`);

      if (eventName === 'subscription_created') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;
        const customerId = data.attributes?.customer_id;
        const status = data.attributes?.status;

        if (companyId) {
          await pool.query(
            `UPDATE companies
             SET subscription_status = $1, lemon_squeezy_customer_id = $2, updated_at = NOW()
             WHERE id = $3`,
            [status, customerId, companyId]
          );

          logInfo('lemonSqueezyService', 'handleWebhook', '✅ Subscription created', {
            companyId,
            status,
          });
        }
      }

      if (eventName === 'subscription_updated') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;
        const status = data.attributes?.status;

        if (companyId) {
          await pool.query(
            `UPDATE companies
             SET subscription_status = $1, updated_at = NOW()
             WHERE id = $2`,
            [status, companyId]
          );

          logInfo('lemonSqueezyService', 'handleWebhook', '✅ Subscription updated', {
            companyId,
            status,
          });
        }
      }

      if (eventName === 'subscription_cancelled') {
        const customData = data.attributes?.checkout_data?.custom;
        const companyId = customData?.company_id;

        if (companyId) {
          await pool.query(
            `UPDATE companies
             SET subscription_status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
            [companyId]
          );

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
