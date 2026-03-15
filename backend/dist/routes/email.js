"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailController_1 = require("../controllers/emailController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public endpoints (no auth)
router.post('/webhook/sendgrid', emailController_1.sendgridWebhook);
router.get('/track/open', emailController_1.trackEmailOpen);
router.get('/track/click', emailController_1.trackEmailClick);
// All other routes require auth
router.use(auth_1.authMiddleware);
// Schedule dunning emails for an invoice
router.post('/schedule', emailController_1.scheduleInvoiceEmails);
// Send a dunning email immediately
router.post('/send-now', emailController_1.sendEmailNow);
// Get email logs
router.get('/logs', emailController_1.getEmailLogs);
// Queue stats
router.get('/queue/stats', emailController_1.getQueueStats);
// Preview email content
router.get('/preview', auth_1.authMiddleware, emailController_1.previewEmail);
exports.default = router;
