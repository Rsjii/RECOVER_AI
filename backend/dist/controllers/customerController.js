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
exports.unsubscribeCustomer = exports.getCustomer = exports.listCustomers = void 0;
const CustomerDB = __importStar(require("../db/customers"));
const InvoiceDB = __importStar(require("../db/invoices"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'customerController';
const listCustomers = async (req, res) => {
    const handler = 'listCustomers';
    const companyId = req.companyId;
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const offset = (page - 1) * limit;
        const { data, total } = await CustomerDB.listCustomers(companyId, limit, offset);
        res.status(200).json({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to list customers', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listCustomers = listCustomers;
const getCustomer = async (req, res) => {
    const handler = 'getCustomer';
    const companyId = req.companyId;
    try {
        const id = req.params.id;
        const customer = await CustomerDB.findCustomerById(id, companyId);
        if (!customer) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Customer not found');
            return;
        }
        // Get their invoices
        const { data: invoices, total: totalInvoices } = await InvoiceDB.listInvoices(companyId, { customerId: id }, 100, 0);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Customer fetched', { customerId: id });
        res.status(200).json({
            data: {
                customer,
                invoices,
                totalInvoices,
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get customer', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getCustomer = getCustomer;
/**
 * POST /api/customers/unsubscribe (no auth — customers click link from email)
 * Body: { token } where token = base64(email:companyId)
 */
const unsubscribeCustomer = async (req, res) => {
    const handler = 'unsubscribeCustomer';
    try {
        const { token } = req.body;
        if (!token) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Missing unsubscribe token');
            return;
        }
        let email, companyId;
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            [email, companyId] = decoded.split(':');
        }
        catch {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invalid unsubscribe token');
            return;
        }
        if (!email || !companyId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invalid unsubscribe token');
            return;
        }
        await database_1.pool.query(`UPDATE customers SET do_not_email = true WHERE email = $1 AND company_id = $2`, [email, companyId]);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Customer unsubscribed', { email, companyId });
        res.status(200).json({ message: 'You have been unsubscribed from future emails.' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Unsubscribe failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.unsubscribeCustomer = unsubscribeCustomer;
