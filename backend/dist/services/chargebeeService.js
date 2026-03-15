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
Object.defineProperty(exports, "__esModule", { value: true });
exports.chargebeeService = void 0;
const CompanyDB = __importStar(require("../db/companies"));
const CustomerDB = __importStar(require("../db/customers"));
const InvoiceDB = __importStar(require("../db/invoices"));
const AuditDB = __importStar(require("../db/auditLogs"));
const encryption_1 = require("../lib/encryption");
const logger_1 = require("../utils/logger");
async function callChargebeeApi(site, apiKey, path) {
    const url = `https://${site}.chargebee.com/api/v2${path}`;
    const credentials = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch(url, {
        headers: {
            Authorization: `Basic ${credentials}`,
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Chargebee API error (${response.status}): ${err}`);
    }
    return response.json();
}
class ChargebeeService {
    async connect(companyId, userId, site, apiKey) {
        const method = 'connect';
        try {
            (0, logger_1.logInfo)('chargebeeService', method, 'Validating Chargebee credentials', { companyId, site });
            // Validate by fetching subscriptions list
            await callChargebeeApi(site, apiKey, '/subscriptions?limit=1');
            await CompanyDB.updateCompany(companyId, {
                chargebee_site: site,
                chargebee_api_key_encrypted: (0, encryption_1.encryptField)(apiKey),
            });
            await AuditDB.createAuditLog({
                companyId,
                userId,
                action: 'CONNECT',
                resourceType: 'integration',
                details: { integration: 'chargebee', site },
            });
            (0, logger_1.logInfo)('chargebeeService', method, 'Chargebee connected', { companyId, site });
        }
        catch (error) {
            (0, logger_1.logError)('chargebeeService', method, 'Connect failed', error, { companyId });
            throw error;
        }
    }
    async syncInvoices(companyId) {
        const method = 'syncInvoices';
        const startTime = Date.now();
        try {
            (0, logger_1.logInfo)('chargebeeService', method, 'Starting Chargebee sync', { companyId });
            const company = await CompanyDB.findCompanyById(companyId);
            if (!company?.chargebee_site || !company?.chargebee_api_key_encrypted) {
                throw new Error('Chargebee not connected for this company');
            }
            const site = company.chargebee_site;
            const apiKey = (0, encryption_1.decryptField)(company.chargebee_api_key_encrypted);
            const result = { created: 0, updated: 0, skipped: 0 };
            // Fetch unpaid invoices from Chargebee
            let offset;
            let hasMore = true;
            while (hasMore) {
                const params = new URLSearchParams({ limit: '100', 'status[is]': 'payment_due' });
                if (offset)
                    params.append('offset', offset);
                const data = await callChargebeeApi(site, apiKey, `/invoices?${params.toString()}`);
                const invoices = data.list || [];
                for (const entry of invoices) {
                    const inv = entry.invoice;
                    if (!inv) {
                        result.skipped++;
                        continue;
                    }
                    const email = inv.billing_address?.email || inv.customer_id;
                    if (!email || !email.includes('@')) {
                        result.skipped++;
                        continue;
                    }
                    const amount = (inv.amount_due || 0) / 100;
                    if (amount <= 0) {
                        result.skipped++;
                        continue;
                    }
                    const customer = await CustomerDB.findOrCreateCustomer({
                        companyId,
                        name: inv.billing_address?.first_name
                            ? `${inv.billing_address.first_name} ${inv.billing_address.last_name || ''}`.trim()
                            : email,
                        email,
                    });
                    const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : new Date();
                    const issuedDate = inv.date ? new Date(inv.date * 1000) : new Date();
                    const { isNew } = await InvoiceDB.upsertInvoice({
                        companyId,
                        customerId: customer.id,
                        amount,
                        currency: (inv.currency_code || 'USD').toUpperCase(),
                        dueDate,
                        issuedDate,
                        source: 'chargebee',
                        sourceId: inv.id,
                    });
                    isNew ? result.created++ : result.updated++;
                }
                if (data.next_offset) {
                    offset = data.next_offset;
                }
                else {
                    hasMore = false;
                }
            }
            (0, logger_1.logInfo)('chargebeeService', method, 'Chargebee sync completed', {
                companyId,
                elapsedMs: Date.now() - startTime,
                ...result,
            });
            return result;
        }
        catch (error) {
            (0, logger_1.logError)('chargebeeService', method, 'Chargebee sync failed', error, { companyId });
            throw error;
        }
    }
    async handleWebhook(companyId, eventType, content) {
        const method = 'handleWebhook';
        try {
            (0, logger_1.logInfo)('chargebeeService', method, 'Processing Chargebee webhook', { companyId, eventType });
            if (eventType === 'invoice_generated' || eventType === 'payment_failed') {
                const inv = content?.invoice;
                if (!inv)
                    return;
                const email = inv.billing_address?.email || inv.customer_id;
                if (!email || !email.includes('@'))
                    return;
                const amount = (inv.amount_due || 0) / 100;
                if (amount <= 0)
                    return;
                const customer = await CustomerDB.findOrCreateCustomer({
                    companyId,
                    name: email,
                    email,
                });
                await InvoiceDB.upsertInvoice({
                    companyId,
                    customerId: customer.id,
                    amount,
                    currency: (inv.currency_code || 'USD').toUpperCase(),
                    dueDate: inv.due_date ? new Date(inv.due_date * 1000) : new Date(),
                    issuedDate: inv.date ? new Date(inv.date * 1000) : new Date(),
                    source: 'chargebee',
                    sourceId: inv.id,
                });
            }
            if (eventType === 'payment_succeeded') {
                const payment = content?.payment;
                if (!payment?.invoice_id)
                    return;
                const invoice = await InvoiceDB.findInvoiceBySourceId(payment.invoice_id, 'chargebee', companyId);
                if (invoice) {
                    await InvoiceDB.updateInvoiceStatus(invoice.id, companyId, 'paid');
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)('chargebeeService', method, 'Webhook processing failed', error);
            throw error;
        }
    }
    async disconnect(companyId, userId) {
        await CompanyDB.updateCompany(companyId, {
            chargebee_site: null,
            chargebee_api_key_encrypted: null,
        });
        await AuditDB.createAuditLog({
            companyId,
            userId,
            action: 'DISCONNECT',
            resourceType: 'integration',
            details: { integration: 'chargebee' },
        });
    }
}
exports.chargebeeService = new ChargebeeService();
