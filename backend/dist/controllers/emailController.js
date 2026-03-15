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
exports.trackEmailClick = exports.trackEmailOpen = exports.previewEmail = exports.getQueueStats = exports.sendgridWebhook = exports.getEmailLogs = exports.sendEmailNow = exports.scheduleInvoiceEmails = void 0;
const dunningQueue_1 = require("../queue/dunningQueue");
const emailLogs_1 = require("../db/emailLogs");
const invoices_1 = require("../db/invoices");
const SecurityDB = __importStar(require("../db/security"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const crypto_1 = __importDefault(require("crypto"));
const LOG_MODULE = 'emailController';
/**
 * Schedule all dunning emails for an invoice
 * POST /api/email/schedule
 */
const scheduleInvoiceEmails = async (req, res) => {
    const handler = 'scheduleInvoiceEmails';
    const companyId = req.companyId;
    try {
        const { invoiceId } = req.body;
        if (!invoiceId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceId is required');
            return;
        }
        const invoice = await (0, invoices_1.findInvoiceById)(invoiceId, companyId);
        if (!invoice) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
            return;
        }
        if (invoice.status === 'paid') {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Cannot schedule emails for a paid invoice');
            return;
        }
        const scheduled = await (0, dunningQueue_1.scheduleDunningEmails)(invoiceId, companyId);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Emails scheduled', { invoiceId, scheduled });
        res.status(200).json({
            message: `${scheduled} dunning emails scheduled`,
            data: { invoiceId, scheduled },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to schedule emails', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.scheduleInvoiceEmails = scheduleInvoiceEmails;
/**
 * Send a dunning email immediately (manual trigger)
 * POST /api/email/send-now
 */
const sendEmailNow = async (req, res) => {
    const handler = 'sendEmailNow';
    const companyId = req.companyId;
    try {
        const { invoiceId, emailType } = req.body;
        if (!invoiceId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceId is required');
            return;
        }
        const invoice = await (0, invoices_1.findInvoiceById)(invoiceId, companyId);
        if (!invoice) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
            return;
        }
        if (!invoice.customer_email) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Customer has no email address');
            return;
        }
        const dueDate = new Date(invoice.due_date).getTime();
        const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000)));
        const jobId = await (0, dunningQueue_1.queueEmailNow)({
            companyId,
            customerId: invoice.customer_id,
            invoiceId,
            recipientEmail: invoice.customer_email,
            customerName: invoice.customer_name || 'Valued Customer',
            invoiceAmount: Number(invoice.amount),
            dueDate: invoice.due_date,
            daysOverdue,
            emailType: emailType || 'dunning_1',
            attemptNumber: 1,
        });
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Email queued for immediate send', { invoiceId, jobId });
        res.status(200).json({
            message: 'Email queued for immediate delivery',
            data: { invoiceId, jobId },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to queue email', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.sendEmailNow = sendEmailNow;
/**
 * List email logs for a company (optionally filtered by invoice)
 * GET /api/email/logs?invoiceId=xxx
 */
const getEmailLogs = async (req, res) => {
    const handler = 'getEmailLogs';
    const companyId = req.companyId;
    try {
        const invoiceId = req.query.invoiceId;
        const logs = await (0, emailLogs_1.listEmailLogs)(companyId, invoiceId);
        res.status(200).json({
            data: logs,
            total: logs.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to fetch email logs', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getEmailLogs = getEmailLogs;
/**
 * SendGrid webhook — track email delivery events (open, click, bounce, etc.)
 * POST /api/email/webhook/sendgrid
 * No auth required — raw body, verified by IP or basic signature
 */
const sendgridWebhook = async (req, res) => {
    const handler = 'sendgridWebhook';
    try {
        const events = Array.isArray(req.body) ? req.body : [];
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'SendGrid webhook received', { eventCount: events.length });
        for (const event of events) {
            const messageId = event.sg_message_id;
            if (!messageId) {
                (0, logger_1.logWarn)(LOG_MODULE, handler, 'Event missing sg_message_id — skipping', { event: event.event });
                continue;
            }
            const eventTimestamp = Number(event.timestamp || 0);
            // 24h replay window for provider retries/replays.
            if (eventTimestamp > 0 && Math.abs(Date.now() / 1000 - eventTimestamp) > 24 * 60 * 60) {
                (0, logger_1.logWarn)(LOG_MODULE, handler, 'Ignored stale SendGrid event', { messageId, event: event.event, eventTimestamp });
                continue;
            }
            const dedupeKey = `${messageId}:${event.event}:${eventTimestamp || 'na'}`;
            const payloadHash = crypto_1.default.createHash('sha256').update(JSON.stringify(event)).digest('hex');
            const accepted = await SecurityDB.registerWebhookEvent({
                provider: 'sendgrid',
                eventId: dedupeKey,
                eventType: event.event,
                payloadHash,
            });
            if (!accepted) {
                (0, logger_1.logInfo)(LOG_MODULE, handler, 'Duplicate SendGrid event ignored', { dedupeKey });
                continue;
            }
            switch (event.event) {
                case 'delivered':
                    await (0, emailLogs_1.updateEmailStatus)(messageId, 'delivered');
                    break;
                case 'open':
                    await (0, emailLogs_1.updateEmailStatus)(messageId, 'opened', 'opened_at');
                    break;
                case 'click':
                    await (0, emailLogs_1.updateEmailStatus)(messageId, 'clicked', 'clicked_at');
                    break;
                case 'bounce':
                case 'blocked':
                case 'invalid_email':
                    await (0, emailLogs_1.updateEmailStatus)(messageId, 'bounced');
                    break;
                default:
                    (0, logger_1.logInfo)(LOG_MODULE, handler, `Unhandled event type: ${event.event}`, { messageId });
            }
            await SecurityDB.completeWebhookEvent('sendgrid', dedupeKey);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Webhook processing error', error);
        // Always return 200 to SendGrid so it doesn't retry
        res.status(200).json({ received: true });
    }
};
exports.sendgridWebhook = sendgridWebhook;
/**
 * Get queue stats (jobs waiting, active, completed, failed)
 * GET /api/email/queue/stats
 */
const getQueueStats = async (req, res) => {
    const handler = 'getQueueStats';
    try {
        const queue = (0, dunningQueue_1.getDunningQueue)();
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);
        res.status(200).json({
            data: { waiting, active, completed, failed, delayed },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get queue stats', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getQueueStats = getQueueStats;
/**
 * Preview AI-generated email for an invoice
 * GET /api/email/preview?invoiceId=xxx&emailType=dunning_1
 */
const previewEmail = async (req, res) => {
    const handler = 'previewEmail';
    const companyId = req.companyId;
    try {
        const { invoiceId, emailType } = req.query;
        if (!invoiceId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceId is required');
            return;
        }
        const invoice = await (0, invoices_1.findInvoiceById)(invoiceId, companyId);
        if (!invoice) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invoice not found');
            return;
        }
        // Use AI service to generate preview (same as agent would generate)
        const aiService = (await Promise.resolve().then(() => __importStar(require('../services/aiService')))).default;
        const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)));
        const generated = await aiService.generateDunningEmail({
            customerId: invoice.customer_id,
            invoiceId: invoice.id,
            customerName: invoice.customer_name || 'Valued Customer',
            companyName: 'Your Company',
            invoiceAmount: parseFloat(invoice.amount),
            dueDate: invoice.due_date,
            daysOverdue,
            riskScore: invoice.risk_score || 50,
        });
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Preview generated', { invoiceId, emailType });
        res.status(200).json({
            data: {
                subject: generated.subject,
                bodyText: generated.bodyText,
                bodyHtml: generated.bodyHtml,
                tone: generated.tone,
                invoiceId,
                emailType: emailType || 'dunning_1',
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Preview generation failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.previewEmail = previewEmail;
// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
/**
 * GET /api/email/track/open?logId=xxx
 * Called when email client loads the tracking pixel.
 */
const trackEmailOpen = async (req, res) => {
    const { logId } = req.query;
    if (logId) {
        (0, emailLogs_1.markEmailOpened)(logId).catch(() => { }); // non-blocking
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).end(TRACKING_PIXEL);
};
exports.trackEmailOpen = trackEmailOpen;
/**
 * GET /api/email/track/click?logId=xxx&url=https://...
 * Records click and 302-redirects to the original URL.
 */
const trackEmailClick = async (req, res) => {
    const { logId, url } = req.query;
    if (logId) {
        (0, emailLogs_1.markEmailClicked)(logId).catch(() => { }); // non-blocking
    }
    const redirectTo = url ? decodeURIComponent(url) : '/';
    // Basic URL safety check — only allow http/https
    if (redirectTo.startsWith('http://') || redirectTo.startsWith('https://')) {
        res.redirect(302, redirectTo);
    }
    else {
        res.redirect(302, '/');
    }
};
exports.trackEmailClick = trackEmailClick;
