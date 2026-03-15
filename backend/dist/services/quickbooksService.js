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
exports.quickbooksService = void 0;
const CompanyDB = __importStar(require("../db/companies"));
const CustomerDB = __importStar(require("../db/customers"));
const InvoiceDB = __importStar(require("../db/invoices"));
const AuditDB = __importStar(require("../db/auditLogs"));
const encryption_1 = require("../lib/encryption");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const QB_BASE_URL = {
    sandbox: 'https://sandbox-quickbooks.api.intuit.com',
    production: 'https://quickbooks.api.intuit.com',
};
const QB_AUTH_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
function getBaseUrl() {
    const env = env_1.config.quickbooks?.environment || 'sandbox';
    return QB_BASE_URL[env];
}
async function exchangeCodeForTokens(code, redirectUri) {
    const clientId = env_1.config.quickbooks?.clientId || '';
    const clientSecret = env_1.config.quickbooks?.clientSecret || '';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(QB_AUTH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }).toString(),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`QB token exchange failed: ${err}`);
    }
    return response.json();
}
async function refreshAccessToken(refreshToken) {
    const clientId = env_1.config.quickbooks?.clientId || '';
    const clientSecret = env_1.config.quickbooks?.clientSecret || '';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(QB_AUTH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }).toString(),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`QB token refresh failed: ${err}`);
    }
    return response.json();
}
async function getAccessToken(companyId) {
    const company = await CompanyDB.findCompanyById(companyId);
    if (!company?.quickbooks_access_token_encrypted || !company?.quickbooks_realm_id) {
        throw new Error('QuickBooks not connected for this company');
    }
    return {
        accessToken: (0, encryption_1.decryptField)(company.quickbooks_access_token_encrypted),
        realmId: company.quickbooks_realm_id,
    };
}
class QuickBooksService {
    getOAuthUrl(companyId, redirectUri) {
        const clientId = env_1.config.quickbooks?.clientId || '';
        const params = new URLSearchParams({
            client_id: clientId,
            scope: 'com.intuit.quickbooks.accounting',
            redirect_uri: redirectUri,
            response_type: 'code',
            state: companyId,
        });
        return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
    }
    async handleOAuthCallback(companyId, userId, code, realmId, redirectUri) {
        const method = 'handleOAuthCallback';
        try {
            (0, logger_1.logInfo)('quickbooksService', method, 'Exchanging QB OAuth code', { companyId, realmId });
            const tokens = await exchangeCodeForTokens(code, redirectUri);
            await CompanyDB.updateCompany(companyId, {
                quickbooks_realm_id: realmId,
                quickbooks_access_token_encrypted: (0, encryption_1.encryptField)(tokens.access_token),
                quickbooks_refresh_token_encrypted: (0, encryption_1.encryptField)(tokens.refresh_token),
            });
            await AuditDB.createAuditLog({
                companyId,
                userId,
                action: 'CONNECT',
                resourceType: 'integration',
                details: { integration: 'quickbooks', realmId },
            });
            (0, logger_1.logInfo)('quickbooksService', method, 'QB connected successfully', { companyId, realmId });
        }
        catch (error) {
            (0, logger_1.logError)('quickbooksService', method, 'QB OAuth callback failed', error, { companyId });
            throw error;
        }
    }
    async syncInvoices(companyId) {
        const method = 'syncInvoices';
        const startTime = Date.now();
        try {
            (0, logger_1.logInfo)('quickbooksService', method, 'Starting QB invoice sync', { companyId });
            let { accessToken, realmId } = await getAccessToken(companyId);
            // Try to sync; if 401, refresh token and retry once
            let invoices = await this.fetchQBInvoices(accessToken, realmId);
            if (invoices === null) {
                // Token expired — refresh
                const company = await CompanyDB.findCompanyById(companyId);
                if (!company?.quickbooks_refresh_token_encrypted)
                    throw new Error('QB refresh token missing');
                const refreshToken = (0, encryption_1.decryptField)(company.quickbooks_refresh_token_encrypted);
                const newTokens = await refreshAccessToken(refreshToken);
                await CompanyDB.updateCompany(companyId, {
                    quickbooks_access_token_encrypted: (0, encryption_1.encryptField)(newTokens.access_token),
                    quickbooks_refresh_token_encrypted: (0, encryption_1.encryptField)(newTokens.refresh_token),
                });
                accessToken = newTokens.access_token;
                invoices = await this.fetchQBInvoices(accessToken, realmId);
                if (invoices === null)
                    throw new Error('QB API failed after token refresh');
            }
            const result = { created: 0, updated: 0, skipped: 0 };
            for (const qbInv of invoices) {
                // Skip if no customer email
                const email = qbInv.BillEmail?.Address || qbInv.CustomerRef?.name;
                if (!email || !email.includes('@')) {
                    result.skipped++;
                    continue;
                }
                const customer = await CustomerDB.findOrCreateCustomer({
                    companyId,
                    name: qbInv.CustomerRef?.name || email,
                    email,
                });
                const amount = parseFloat(qbInv.Balance || qbInv.TotalAmt || '0');
                if (amount <= 0) {
                    result.skipped++;
                    continue;
                }
                const dueDate = qbInv.DueDate ? new Date(qbInv.DueDate) : new Date();
                const issuedDate = qbInv.TxnDate ? new Date(qbInv.TxnDate) : new Date();
                const { isNew } = await InvoiceDB.upsertInvoice({
                    companyId,
                    customerId: customer.id,
                    amount,
                    currency: 'USD',
                    dueDate,
                    issuedDate,
                    source: 'quickbooks',
                    sourceId: qbInv.Id,
                });
                isNew ? result.created++ : result.updated++;
            }
            (0, logger_1.logInfo)('quickbooksService', method, 'QB sync completed', {
                companyId,
                elapsedMs: Date.now() - startTime,
                ...result,
            });
            return result;
        }
        catch (error) {
            (0, logger_1.logError)('quickbooksService', method, 'QB sync failed', error, { companyId });
            throw error;
        }
    }
    async fetchQBInvoices(accessToken, realmId) {
        const baseUrl = getBaseUrl();
        const query = "SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 200";
        const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });
        if (response.status === 401)
            return null; // Token expired
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`QB API error: ${err}`);
        }
        const data = (await response.json());
        return data?.QueryResponse?.Invoice || [];
    }
    async disconnect(companyId, userId) {
        await CompanyDB.updateCompany(companyId, {
            quickbooks_realm_id: null,
            quickbooks_access_token_encrypted: null,
            quickbooks_refresh_token_encrypted: null,
        });
        await AuditDB.createAuditLog({
            companyId,
            userId,
            action: 'DISCONNECT',
            resourceType: 'integration',
            details: { integration: 'quickbooks' },
        });
    }
    isConnected(company) {
        return !!(company.quickbooks_realm_id && company.quickbooks_access_token_encrypted);
    }
}
exports.quickbooksService = new QuickBooksService();
