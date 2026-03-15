"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const CustomerDB = __importStar(require("../db/customers"));
const InvoiceDB = __importStar(require("../db/invoices"));
const CompanyDB = __importStar(require("../db/companies"));
const AuditDB = __importStar(require("../db/auditLogs"));
const PaymentDB = __importStar(require("../db/payments"));
const SecurityDB = __importStar(require("../db/security"));
const crypto_1 = __importDefault(require("crypto"));
const slackService_1 = require("./slackService");
const encryption_1 = require("../lib/encryption");
const logger_1 = require("../utils/logger");
function getStripeClient(apiKey) {
    return new stripe_1.default(apiKey);
}
class StripeService {
    async connectStripe(companyId, userId, input) {
        const method = 'connectStripe';
        const startTime = Date.now();
        try {
            const { stripeApiKey } = input;
            (0, logger_1.logInfo)('stripeService', method, 'Starting Stripe connect', { companyId, userId });
            const stripe = getStripeClient(stripeApiKey);
            await stripe.accounts.retrieve();
            const encrypted = (0, encryption_1.encryptField)(stripeApiKey);
            await CompanyDB.updateCompany(companyId, { stripe_api_key_encrypted: encrypted });
            await AuditDB.createAuditLog({
                companyId,
                userId,
                action: 'CONNECT',
                resourceType: 'integration',
                details: { integration: 'stripe' },
            });
            (0, logger_1.logInfo)('stripeService', method, 'Stripe connected successfully', {
                companyId,
                elapsedMs: Date.now() - startTime,
            });
        }
        catch (error) {
            (0, logger_1.logError)('stripeService', method, 'Stripe connect failed', error, {
                companyId,
                elapsedMs: Date.now() - startTime,
            });
            throw error;
        }
    }
    async syncInvoices(companyId) {
        const method = 'syncInvoices';
        const startTime = Date.now();
        try {
            (0, logger_1.logInfo)('stripeService', method, 'Starting Stripe sync', { companyId });
            const company = await CompanyDB.findCompanyById(companyId);
            if (!company?.stripe_api_key_encrypted) {
                throw new Error('Stripe not connected for this company');
            }
            const apiKey = (0, encryption_1.decryptField)(company.stripe_api_key_encrypted);
            const stripe = getStripeClient(apiKey);
            const result = { created: 0, updated: 0, skipped: 0 };
            const stripeInvoices = await stripe.invoices.list({ status: 'open', limit: 100 });
            for (const inv of stripeInvoices.data) {
                if (!inv.customer_email) {
                    result.skipped++;
                    continue;
                }
                const customer = await CustomerDB.findOrCreateCustomer({
                    companyId,
                    name: inv.customer_name || inv.customer_email,
                    email: inv.customer_email,
                });
                const { isNew } = await InvoiceDB.upsertInvoice({
                    companyId,
                    customerId: customer.id,
                    amount: inv.amount_due / 100,
                    currency: inv.currency.toUpperCase(),
                    dueDate: inv.due_date ? new Date(inv.due_date * 1000) : new Date(),
                    issuedDate: new Date(inv.created * 1000),
                    source: 'stripe',
                    sourceId: inv.id,
                });
                isNew ? result.created++ : result.updated++;
            }
            // Update last synced timestamp
            await CompanyDB.updateCompany(companyId, { stripe_last_synced_at: new Date() });
            (0, logger_1.logInfo)('stripeService', method, 'Stripe sync completed', {
                companyId,
                elapsedMs: Date.now() - startTime,
                ...result,
            });
            return result;
        }
        catch (error) {
            (0, logger_1.logError)('stripeService', method, 'Stripe sync failed', error, {
                companyId,
                elapsedMs: Date.now() - startTime,
            });
            throw error;
        }
    }
    async handleWebhook(rawBody, signature) {
        const method = 'handleWebhook';
        const startTime = Date.now();
        let processedEventId = null;
        try {
            const webhookSecret = env_1.config.stripe.webhookSecret;
            if (!webhookSecret)
                throw new Error('Stripe webhook secret not configured');
            const stripe = new stripe_1.default(env_1.config.stripe.apiKey || '');
            const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret, 300);
            processedEventId = event.id;
            // Additional replay protection guard: stale events beyond 24h are ignored.
            if (Math.abs(Date.now() / 1000 - event.created) > 24 * 60 * 60) {
                (0, logger_1.logInfo)('stripeService', method, 'Ignored stale webhook event', { eventId: event.id, created: event.created });
                return;
            }
            const payloadHash = crypto_1.default.createHash('sha256').update(rawBody).digest('hex');
            const accepted = await SecurityDB.registerWebhookEvent({
                provider: 'stripe',
                eventId: event.id,
                eventType: event.type,
                payloadHash,
            });
            if (!accepted) {
                (0, logger_1.logInfo)('stripeService', method, 'Duplicate webhook ignored', { eventId: event.id, eventType: event.type });
                return;
            }
            (0, logger_1.logInfo)('stripeService', method, 'Processing webhook', { eventType: event.type });
            switch (event.type) {
                case 'invoice.paid': {
                    await this.handleInvoicePaid(event.data.object);
                    break;
                }
                case 'invoice.payment_failed': {
                    const inv = event.data.object;
                    (0, logger_1.logInfo)('stripeService', method, 'Invoice payment failed', {
                        stripeInvoiceId: inv.id,
                        customerId: inv.customer,
                    });
                    // Dunning worker will handle re-sending emails automatically on next cycle
                    break;
                }
                case 'charge.succeeded': {
                    const charge = event.data.object;
                    (0, logger_1.logInfo)('stripeService', method, 'Charge succeeded', { chargeId: charge.id });
                    // charge.succeeded fires alongside invoice.paid — avoid duplicate handling
                    // Only handle if no invoice attached (direct charge scenario)
                    if (!charge.invoice) {
                        await this.handleDirectCharge(charge);
                    }
                    break;
                }
                case 'charge.failed': {
                    const charge = event.data.object;
                    (0, logger_1.logInfo)('stripeService', method, 'Charge failed', {
                        chargeId: charge.id,
                        failureMessage: charge.failure_message,
                    });
                    break;
                }
                default:
                    (0, logger_1.logInfo)('stripeService', method, `Unhandled event type: ${event.type}`);
            }
            (0, logger_1.logInfo)('stripeService', method, 'Webhook handled', {
                eventType: event.type,
                eventId: event.id,
                elapsedMs: Date.now() - startTime,
            });
            await SecurityDB.completeWebhookEvent('stripe', event.id);
        }
        catch (error) {
            if (processedEventId) {
                await SecurityDB.failWebhookEvent('stripe', processedEventId, error instanceof Error ? error.message : String(error));
            }
            (0, logger_1.logError)('stripeService', method, 'Webhook handling failed', error, {
                elapsedMs: Date.now() - startTime,
            });
            throw error;
        }
    }
    async handleInvoicePaid(inv) {
        const method = 'handleInvoicePaid';
        // Find our internal invoice by Stripe invoice ID
        const invoice = await InvoiceDB.findInvoiceBySourceId(inv.id, 'stripe');
        if (!invoice) {
            (0, logger_1.logInfo)('stripeService', method, 'Internal invoice not found for stripe invoice', {
                stripeInvoiceId: inv.id,
            });
            return;
        }
        if (invoice.status === 'paid') {
            (0, logger_1.logInfo)('stripeService', method, 'Invoice already marked as paid', { invoiceId: invoice.id });
            return;
        }
        // Mark invoice as paid
        await InvoiceDB.updateInvoiceStatus(invoice.id, invoice.company_id, 'paid');
        // Record payment
        const amountPaid = (inv.amount_paid || 0) / 100;
        await PaymentDB.createPayment({
            invoiceId: invoice.id,
            companyId: invoice.company_id,
            amount: amountPaid,
            currency: (inv.currency || 'usd').toUpperCase(),
            paymentMethod: 'stripe',
            paidAt: new Date((inv.status_transitions?.paid_at || Date.now() / 1000) * 1000),
            stripeChargeId: typeof inv.charge === 'string' ? inv.charge : inv.charge?.id,
            status: 'succeeded',
        });
        // Update customer payment history
        try {
            await CustomerDB.updateCustomerPaymentHistory(invoice.customer_id);
        }
        catch (err) {
            (0, logger_1.logError)('stripeService', method, 'Failed to update customer history (non-blocking)', err);
        }
        // Slack alert
        try {
            await (0, slackService_1.sendPaymentAlert)({
                customerName: invoice.customer_name || 'Unknown',
                amount: amountPaid,
                currency: invoice.currency,
                invoiceId: invoice.id,
            });
        }
        catch (err) {
            (0, logger_1.logError)('stripeService', method, 'Failed to send Slack alert (non-blocking)', err);
        }
        (0, logger_1.logInfo)('stripeService', method, 'Invoice paid handled', {
            invoiceId: invoice.id,
            amount: amountPaid,
        });
    }
    async handleDirectCharge(charge) {
        const method = 'handleDirectCharge';
        // Direct charge (not invoice-based) — log only, no invoice to update
        (0, logger_1.logInfo)('stripeService', method, 'Direct charge succeeded (no invoice)', {
            chargeId: charge.id,
            amount: charge.amount / 100,
            currency: charge.currency,
        });
    }
    // OAuth: Exchange authorization code for access token
    async getAccessToken(code) {
        const method = 'getAccessToken';
        try {
            (0, logger_1.logInfo)('stripeService', method, 'Exchanging OAuth code for token');
            const response = await fetch('https://connect.stripe.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_secret: env_1.config.stripe.clientSecret || '',
                    code,
                    grant_type: 'authorization_code',
                }).toString(),
            });
            const data = (await response.json());
            if (data.error) {
                throw new Error(data.error_description || data.error);
            }
            (0, logger_1.logInfo)('stripeService', method, '✅ OAuth token received', {
                user_id: data.stripe_user_id,
            });
            return {
                access_token: data.access_token,
                stripe_user_id: data.stripe_user_id,
            };
        }
        catch (error) {
            (0, logger_1.logError)('stripeService', method, 'OAuth error', error);
            return {
                access_token: '',
                stripe_user_id: '',
                error: error.message,
            };
        }
    }
    // Connect via OAuth (saves encrypted token)
    async connectViaOAuth(companyId, userId, code) {
        const method = 'connectViaOAuth';
        try {
            (0, logger_1.logInfo)('stripeService', method, 'Starting OAuth connection', { companyId });
            const tokenResult = await this.getAccessToken(code);
            if (tokenResult.error) {
                throw new Error(tokenResult.error);
            }
            // Encrypt and save token
            const encrypted = (0, encryption_1.encryptField)(tokenResult.access_token);
            await CompanyDB.updateCompany(companyId, {
                stripe_api_key_encrypted: encrypted,
                stripe_account_id: tokenResult.stripe_user_id,
            });
            await AuditDB.createAuditLog({
                companyId,
                userId,
                action: 'CONNECT_OAUTH',
                resourceType: 'integration',
                details: { integration: 'stripe', oauthUserId: tokenResult.stripe_user_id },
            });
            (0, logger_1.logInfo)('stripeService', method, '✅ OAuth connection successful', {
                companyId,
                stripeUserId: tokenResult.stripe_user_id,
            });
        }
        catch (error) {
            (0, logger_1.logError)('stripeService', method, 'OAuth connection failed', error, { companyId });
            throw error;
        }
    }
}
exports.stripeService = new StripeService();
