"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chargebeeController_1 = require("../controllers/chargebeeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Webhook (no auth — from Chargebee servers)
router.post('/webhook', chargebeeController_1.chargebeeWebhook);
// Protected routes
router.post('/connect', auth_1.authMiddleware, chargebeeController_1.connectChargebee);
router.post('/sync', auth_1.authMiddleware, chargebeeController_1.syncChargebeeInvoices);
router.delete('/disconnect', auth_1.authMiddleware, chargebeeController_1.disconnectChargebee);
exports.default = router;
