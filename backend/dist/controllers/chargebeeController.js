"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectChargebee = exports.chargebeeWebhook = exports.syncChargebeeInvoices = exports.connectChargebee = void 0;
const chargebeeService_1 = require("../services/chargebeeService");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const LOG_MODULE = 'chargebeeController';
const connectChargebee = async (req, res) => {
    try {
        const companyId = req.companyId;
        const userId = req.userId;
        const { site, apiKey } = req.body;
        if (!site || !apiKey) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'site and apiKey are required');
        }
        await chargebeeService_1.chargebeeService.connect(companyId, userId, site.trim(), apiKey.trim());
        return res.status(200).json({ message: 'Chargebee connected successfully' });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'connectChargebee', 'Failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.connectChargebee = connectChargebee;
const syncChargebeeInvoices = async (req, res) => {
    try {
        const companyId = req.companyId;
        (0, logger_1.logInfo)(LOG_MODULE, 'syncChargebeeInvoices', 'Manual sync requested', { companyId });
        const result = await chargebeeService_1.chargebeeService.syncInvoices(companyId);
        return res.status(200).json({ message: 'Chargebee sync complete', result });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'syncChargebeeInvoices', 'Sync failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.syncChargebeeInvoices = syncChargebeeInvoices;
const chargebeeWebhook = async (req, res) => {
    try {
        const { event_type, content, customer } = req.body;
        if (!event_type)
            return res.status(200).json({ received: true });
        // Find company by chargebee customer if possible — for now accept all and log
        // In production: verify webhook signature and resolve companyId from customer
        const companyId = req.query.companyId;
        if (companyId) {
            await chargebeeService_1.chargebeeService.handleWebhook(companyId, event_type, content);
        }
        return res.status(200).json({ received: true });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'chargebeeWebhook', 'Webhook failed', err);
        return res.status(200).json({ received: true }); // Always 200 to Chargebee
    }
};
exports.chargebeeWebhook = chargebeeWebhook;
const disconnectChargebee = async (req, res) => {
    try {
        const companyId = req.companyId;
        const userId = req.userId;
        await chargebeeService_1.chargebeeService.disconnect(companyId, userId);
        return res.status(200).json({ message: 'Chargebee disconnected' });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'disconnectChargebee', 'Failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.disconnectChargebee = disconnectChargebee;
