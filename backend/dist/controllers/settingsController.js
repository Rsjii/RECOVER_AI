"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGeneralSettings = exports.updateSlackSettings = exports.updateDunningSettings = exports.getSettings = void 0;
const companies_1 = require("../db/companies");
const encryption_1 = require("../lib/encryption");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'settingsController';
/**
 * GET /api/settings
 * Returns company settings (dunning strategy, timezone, slack configured, integrations status)
 */
const getSettings = async (req, res) => {
    const handler = 'getSettings';
    const companyId = req.companyId;
    try {
        const company = await (0, companies_1.findCompanyById)(companyId);
        if (!company) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Company not found');
            return;
        }
        res.status(200).json({
            data: {
                companyId: company.id,
                companyName: company.name,
                timezone: company.timezone,
                preferredCurrency: company.preferred_currency,
                dunningStrategy: company.dunning_strategy,
                integrations: {
                    stripe: !!company.stripe_api_key_encrypted,
                    stripeLastSyncedAt: company.stripe_last_synced_at || null,
                    slack: !!company.slack_webhook_url_encrypted,
                    quickbooks: !!(company.quickbooks_realm_id && company.quickbooks_access_token_encrypted),
                    chargebee: !!(company.chargebee_site && company.chargebee_api_key_encrypted),
                },
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get settings', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getSettings = getSettings;
/**
 * PUT /api/settings/dunning
 * Update dunning strategy: num_emails, days_between, approval_required
 */
const updateDunningSettings = async (req, res) => {
    const handler = 'updateDunningSettings';
    const companyId = req.companyId;
    try {
        const { num_emails, days_between, approval_required } = req.body;
        const updates = {};
        if (num_emails !== undefined) {
            const n = parseInt(num_emails);
            if (isNaN(n) || n < 1 || n > 10) {
                (0, errorHandler_1.sendErrorResponse)(res, 400, 'num_emails must be between 1 and 10');
                return;
            }
            updates.num_emails = n;
        }
        if (days_between !== undefined) {
            const d = parseInt(days_between);
            if (isNaN(d) || d < 1 || d > 90) {
                (0, errorHandler_1.sendErrorResponse)(res, 400, 'days_between must be between 1 and 90');
                return;
            }
            updates.days_between = d;
        }
        if (approval_required !== undefined) {
            updates.approval_required = Boolean(approval_required);
        }
        if (Object.keys(updates).length === 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'No valid fields provided');
            return;
        }
        const company = await (0, companies_1.findCompanyById)(companyId);
        const currentStrategy = company?.dunning_strategy || {};
        const newStrategy = { ...currentStrategy, ...updates };
        await (0, companies_1.updateCompany)(companyId, { dunning_strategy: JSON.stringify(newStrategy) });
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Dunning settings updated', { companyId, updates });
        res.status(200).json({ data: { dunningStrategy: newStrategy } });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to update dunning settings', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateDunningSettings = updateDunningSettings;
/**
 * PUT /api/settings/slack
 * Save Slack webhook URL (encrypted)
 */
const updateSlackSettings = async (req, res) => {
    const handler = 'updateSlackSettings';
    const companyId = req.companyId;
    try {
        const { webhookUrl } = req.body;
        if (!webhookUrl) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'webhookUrl is required');
            return;
        }
        if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invalid Slack webhook URL');
            return;
        }
        const encrypted = (0, encryption_1.encryptField)(webhookUrl);
        await (0, companies_1.updateCompany)(companyId, { slack_webhook_url_encrypted: encrypted });
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Slack webhook saved', { companyId });
        res.status(200).json({ message: 'Slack webhook URL saved' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to update Slack settings', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateSlackSettings = updateSlackSettings;
/**
 * PUT /api/settings/general
 * Update timezone, preferred currency
 */
const updateGeneralSettings = async (req, res) => {
    const handler = 'updateGeneralSettings';
    const companyId = req.companyId;
    try {
        const { timezone, preferredCurrency } = req.body;
        const updates = {};
        if (timezone)
            updates.timezone = timezone;
        if (preferredCurrency)
            updates.preferred_currency = preferredCurrency.toUpperCase();
        if (Object.keys(updates).length === 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'No valid fields provided');
            return;
        }
        const company = await (0, companies_1.updateCompany)(companyId, updates);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'General settings updated', { companyId, updates });
        res.status(200).json({
            data: {
                timezone: company.timezone,
                preferredCurrency: company.preferred_currency,
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to update general settings', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateGeneralSettings = updateGeneralSettings;
