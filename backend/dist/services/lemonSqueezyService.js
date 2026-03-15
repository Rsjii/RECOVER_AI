"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LemonSqueezyService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../config/database");
const env_1 = require("../config/env");
const crypto_1 = __importDefault(require("crypto"));
class LemonSqueezyService {
    constructor() {
        this.apiKey = env_1.config.lemonSqueezy.apiKey;
        this.storeId = env_1.config.lemonSqueezy.storeId;
        this.webhookSecret = env_1.config.lemonSqueezy.webhookSecret;
    }
    async createCheckout(params) {
        try {
            (0, logger_1.logInfo)('lemonSqueezyService', 'createCheckout', `Creating checkout`, {
                plan: params.planId,
                email: params.customerEmail,
            });
            // Product IDs (you'll set these from Lemon Squeezy dashboard)
            const productIds = {
                starter: process.env.LS_PRODUCT_STARTER_ID || '123456',
                growth: process.env.LS_PRODUCT_GROWTH_ID || '123457',
                enterprise: process.env.LS_PRODUCT_ENTERPRISE_ID || '123458',
            };
            const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
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
            });
            const data = (await response.json());
            if (!response.ok || data.errors) {
                throw new Error(data.errors?.[0]?.detail || 'Failed to create checkout');
            }
            const checkoutUrl = data.data?.attributes?.url;
            (0, logger_1.logInfo)('lemonSqueezyService', 'createCheckout', '✅ Checkout created', {
                url: checkoutUrl,
            });
            return {
                success: true,
                checkoutUrl,
            };
        }
        catch (error) {
            (0, logger_1.logError)('lemonSqueezyService', 'createCheckout', 'Error', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    verifyWebhookSignature(body, signature) {
        try {
            const hash = crypto_1.default
                .createHmac('sha256', this.webhookSecret)
                .update(body)
                .digest('hex');
            return hash === signature;
        }
        catch (error) {
            (0, logger_1.logError)('lemonSqueezyService', 'verifyWebhook', 'Error verifying', error);
            return false;
        }
    }
    async handleWebhook(event) {
        try {
            const eventName = event.meta?.event_name;
            const data = event.data;
            (0, logger_1.logInfo)('lemonSqueezyService', 'handleWebhook', `Event: ${eventName}`);
            if (eventName === 'subscription_created') {
                const customData = data.attributes?.checkout_data?.custom;
                const companyId = customData?.company_id;
                const customerId = data.attributes?.customer_id;
                const status = data.attributes?.status;
                if (companyId) {
                    await database_1.pool.query(`UPDATE companies
             SET subscription_status = $1, lemon_squeezy_customer_id = $2, updated_at = NOW()
             WHERE id = $3`, [status, customerId, companyId]);
                    (0, logger_1.logInfo)('lemonSqueezyService', 'handleWebhook', '✅ Subscription created', {
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
                    await database_1.pool.query(`UPDATE companies
             SET subscription_status = $1, updated_at = NOW()
             WHERE id = $2`, [status, companyId]);
                    (0, logger_1.logInfo)('lemonSqueezyService', 'handleWebhook', '✅ Subscription updated', {
                        companyId,
                        status,
                    });
                }
            }
            if (eventName === 'subscription_cancelled') {
                const customData = data.attributes?.checkout_data?.custom;
                const companyId = customData?.company_id;
                if (companyId) {
                    await database_1.pool.query(`UPDATE companies
             SET subscription_status = 'cancelled', updated_at = NOW()
             WHERE id = $1`, [companyId]);
                    (0, logger_1.logInfo)('lemonSqueezyService', 'handleWebhook', '✅ Subscription cancelled', {
                        companyId,
                    });
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)('lemonSqueezyService', 'handleWebhook', 'Error processing webhook', error);
        }
    }
}
exports.LemonSqueezyService = LemonSqueezyService;
exports.default = new LemonSqueezyService();
