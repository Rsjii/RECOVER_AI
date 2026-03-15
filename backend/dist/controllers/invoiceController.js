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
exports.uploadCSV = exports.uploadCSVFile = exports.updateInvoiceStatus = exports.createManualInvoice = exports.getInvoiceDetail = exports.getInvoice = exports.listInvoices = void 0;
const InvoiceDB = __importStar(require("../db/invoices"));
const CustomerDB = __importStar(require("../db/customers"));
const PaymentDB = __importStar(require("../db/payments"));
const emailLogs_1 = require("../db/emailLogs");
const paymentPlans_1 = require("../db/paymentPlans");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'invoiceController';
function logInfo(handler, msg, data) {
    (0, logger_1.logInfo)(LOG_MODULE, handler, msg, data);
}
function logError(handler, msg, error) {
    (0, logger_1.logError)(LOG_MODULE, handler, msg, error);
}
const listInvoices = async (req, res) => {
    const handler = 'listInvoices';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const { status, customerId, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const offset = (pageNum - 1) * limitNum;
        logInfo(handler, 'Request received', { companyId, status, customerId, page: pageNum, limit: limitNum });
        const { data, total } = await InvoiceDB.listInvoices(companyId, { status, customerId }, limitNum, offset);
        logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { total, returned: data.length });
        return res.status(200).json({
            data,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listInvoices = listInvoices;
const getInvoice = async (req, res) => {
    const handler = 'getInvoice';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id)
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invoice ID is required');
        const invoice = await InvoiceDB.findInvoiceById(id, companyId);
        if (!invoice)
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
        logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { invoiceId: id });
        return res.status(200).json({ id: invoice.id, data: invoice });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getInvoice = getInvoice;
/**
 * GET /api/invoices/:id/detail
 * Full invoice detail: invoice + customer + payments + email logs + payment plan
 */
const getInvoiceDetail = async (req, res) => {
    const handler = 'getInvoiceDetail';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const id = req.params.id;
        const invoice = await InvoiceDB.findInvoiceById(id, companyId);
        if (!invoice)
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
        const [payments, emailLogs, paymentPlan] = await Promise.all([
            PaymentDB.listPaymentsByInvoice(id, companyId),
            (0, emailLogs_1.listEmailLogs)(companyId, id),
            (0, paymentPlans_1.findPaymentPlanByInvoice)(id, companyId),
        ]);
        logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { invoiceId: id });
        return res.status(200).json({
            data: {
                invoice,
                payments,
                emailLogs,
                paymentPlan: paymentPlan || null,
            },
        });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getInvoiceDetail = getInvoiceDetail;
/**
 * POST /api/invoices/manual
 * Create a manual invoice (not from Stripe/QB)
 */
const createManualInvoice = async (req, res) => {
    const handler = 'createManualInvoice';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const { customerId, amount, currency = 'USD', dueDate, issuedDate, notes } = req.body;
        const missing = [];
        if (!customerId)
            missing.push('customerId');
        if (!amount)
            missing.push('amount');
        if (!dueDate)
            missing.push('dueDate');
        if (!issuedDate)
            missing.push('issuedDate');
        if (missing.length > 0) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, `Missing required fields: ${missing.join(', ')}`);
        }
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'amount must be a positive number');
        }
        // Verify customer belongs to this company
        const customer = await CustomerDB.findCustomerById(customerId, companyId);
        if (!customer)
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Customer not found');
        const invoice = await InvoiceDB.createManualInvoice({
            companyId,
            customerId,
            amount: parseFloat(amount),
            currency: currency.toUpperCase(),
            dueDate: new Date(dueDate),
            issuedDate: new Date(issuedDate),
            source: 'manual',
            notes,
        });
        logInfo(handler, `Manual invoice created in ${Date.now() - startTime}ms`, {
            invoiceId: invoice.id,
            companyId,
            customerId,
            amount,
        });
        return res.status(201).json({ data: invoice });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.createManualInvoice = createManualInvoice;
/**
 * PUT /api/invoices/:id/status
 * Manually update invoice status
 */
const updateInvoiceStatus = async (req, res) => {
    const handler = 'updateInvoiceStatus';
    const startTime = Date.now();
    try {
        const companyId = req.companyId;
        const id = req.params.id;
        const { status } = req.body;
        const validStatuses = ['unpaid', 'paid', 'arranged', 'disputed', 'uncollectable'];
        if (!status || !validStatuses.includes(status)) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, `status must be one of: ${validStatuses.join(', ')}`);
        }
        const invoice = await InvoiceDB.findInvoiceById(id, companyId);
        if (!invoice)
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
        const updated = await InvoiceDB.updateInvoiceStatus(id, companyId, status);
        logInfo(handler, `Status updated in ${Date.now() - startTime}ms`, { invoiceId: id, status });
        return res.status(200).json({ data: updated });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateInvoiceStatus = updateInvoiceStatus;
/**
 * POST /api/invoices/csv-upload
 * Upload invoices from CSV file
 */
const uploadCSVFile = async (req, res) => {
    const handler = 'uploadCSVFile';
    const companyId = req.companyId;
    const startTime = Date.now();
    try {
        // Handle file as raw text (sent from FormData)
        let csvText = '';
        if (typeof req.body === 'string') {
            csvText = req.body;
        }
        else if (req.body.csv) {
            csvText = req.body.csv;
        }
        if (!csvText || csvText.trim().length === 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'CSV content is required');
            return;
        }
        // Parse CSV: expected format is customer_name,customer_email,amount,currency,due_date
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'CSV must contain at least a header row and one data row');
            return;
        }
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const invoices = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.every(v => !v))
                continue; // Skip empty lines
            const row = {};
            header.forEach((col, idx) => {
                row[col] = values[idx] || '';
            });
            invoices.push({
                customerName: row['customer_name'] || row['name'] || '',
                customerEmail: row['customer_email'] || row['email'] || '',
                amount: parseFloat(row['amount'] || '0'),
                currency: (row['currency'] || 'USD').toUpperCase(),
                dueDate: row['due_date'] || new Date().toISOString().split('T')[0],
                issuedDate: row['issued_date'],
            });
        }
        if (invoices.length === 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'No valid invoice rows found');
            return;
        }
        if (invoices.length > 500) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Maximum 500 invoices per upload');
            return;
        }
        let created = 0;
        let skipped = 0;
        for (const inv of invoices) {
            try {
                if (!inv.customerEmail || !inv.amount || inv.amount <= 0) {
                    skipped++;
                    continue;
                }
                const customer = await CustomerDB.findOrCreateCustomer({
                    companyId,
                    name: inv.customerName || inv.customerEmail,
                    email: inv.customerEmail,
                });
                await InvoiceDB.createManualInvoice({
                    companyId,
                    customerId: customer.id,
                    amount: inv.amount,
                    currency: inv.currency || 'USD',
                    dueDate: new Date(inv.dueDate),
                    issuedDate: inv.issuedDate ? new Date(inv.issuedDate) : new Date(),
                    source: 'manual',
                });
                created++;
            }
            catch {
                skipped++;
            }
        }
        logInfo(handler, `CSV upload complete in ${Date.now() - startTime}ms`, { companyId, created, skipped, total: invoices.length });
        res.status(200).json({ data: { count: created, skipped, total: invoices.length } });
    }
    catch (error) {
        logError(handler, `CSV upload failed after ${Date.now() - startTime}ms`, error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.uploadCSVFile = uploadCSVFile;
/**
 * POST /api/invoices/upload-csv
 * Upload invoices from CSV data (JSON array)
 */
const uploadCSV = async (req, res) => {
    const handler = 'uploadCSV';
    const companyId = req.companyId;
    const startTime = Date.now();
    try {
        const { invoices } = req.body; // Array of { customerEmail, customerName, amount, dueDate, currency }
        if (!Array.isArray(invoices) || invoices.length === 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoices array is required');
            return;
        }
        if (invoices.length > 500) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Maximum 500 invoices per upload');
            return;
        }
        let created = 0;
        let skipped = 0;
        for (const inv of invoices) {
            try {
                if (!inv.customerEmail || !inv.amount || !inv.dueDate) {
                    skipped++;
                    continue;
                }
                const customer = await CustomerDB.findOrCreateCustomer({
                    companyId,
                    name: inv.customerName || inv.customerEmail,
                    email: inv.customerEmail,
                });
                await InvoiceDB.upsertInvoice({
                    companyId,
                    customerId: customer.id,
                    amount: Number(inv.amount),
                    currency: (inv.currency || 'USD').toUpperCase(),
                    dueDate: new Date(inv.dueDate),
                    issuedDate: new Date(inv.issuedDate || new Date()),
                    source: 'manual',
                    sourceId: `csv-${Date.now()}-${created}`,
                });
                created++;
            }
            catch {
                skipped++;
            }
        }
        logInfo(handler, `CSV upload complete in ${Date.now() - startTime}ms`, { companyId, created, skipped });
        res.status(200).json({ message: 'Upload complete', created, skipped });
    }
    catch (error) {
        logError(handler, `CSV upload failed after ${Date.now() - startTime}ms`, error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.uploadCSV = uploadCSV;
