"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectQB = exports.syncQBInvoices = exports.qbOAuthCallback = exports.qbOAuthAuthorize = void 0;
const quickbooksService_1 = require("../services/quickbooksService");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const LOG_MODULE = 'quickbooksController';
const qbOAuthAuthorize = async (req, res) => {
    try {
        const companyId = req.companyId;
        const redirectUri = `${process.env.BACKEND_URL}/api/quickbooks/oauth/callback`;
        const url = quickbooksService_1.quickbooksService.getOAuthUrl(companyId, redirectUri);
        (0, logger_1.logInfo)(LOG_MODULE, 'qbOAuthAuthorize', 'Redirecting to QB OAuth', { companyId });
        return res.redirect(url);
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'qbOAuthAuthorize', 'Failed', err);
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=qb_auth_failed`);
    }
};
exports.qbOAuthAuthorize = qbOAuthAuthorize;
const qbOAuthCallback = async (req, res) => {
    try {
        const { code, state, realmId, error } = req.query;
        const frontendUrl = process.env.FRONTEND_URL;
        if (error) {
            return res.redirect(`${frontendUrl}/settings?error=${error}`);
        }
        if (!code || !state || !realmId) {
            return res.redirect(`${frontendUrl}/settings?error=qb_missing_params`);
        }
        const companyId = state;
        const userId = req.userId || 'system';
        const redirectUri = `${process.env.BACKEND_URL}/api/quickbooks/oauth/callback`;
        await quickbooksService_1.quickbooksService.handleOAuthCallback(companyId, userId, code, realmId, redirectUri);
        return res.redirect(`${frontendUrl}/settings?qb=connected`);
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'qbOAuthCallback', 'Failed', err);
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=qb_connection_failed`);
    }
};
exports.qbOAuthCallback = qbOAuthCallback;
const syncQBInvoices = async (req, res) => {
    try {
        const companyId = req.companyId;
        (0, logger_1.logInfo)(LOG_MODULE, 'syncQBInvoices', 'Manual sync requested', { companyId });
        const result = await quickbooksService_1.quickbooksService.syncInvoices(companyId);
        return res.status(200).json({ message: 'QuickBooks sync complete', result });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'syncQBInvoices', 'Sync failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.syncQBInvoices = syncQBInvoices;
const disconnectQB = async (req, res) => {
    try {
        const companyId = req.companyId;
        const userId = req.userId;
        await quickbooksService_1.quickbooksService.disconnect(companyId, userId);
        return res.status(200).json({ message: 'QuickBooks disconnected' });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'disconnectQB', 'Failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.disconnectQB = disconnectQB;
