"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const quickbooksController_1 = require("../controllers/quickbooksController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// OAuth flow (authorize redirects browser, callback is from QB)
router.get('/oauth/authorize', auth_1.authMiddleware, quickbooksController_1.qbOAuthAuthorize);
router.get('/oauth/callback', quickbooksController_1.qbOAuthCallback);
// Protected routes
router.post('/sync', auth_1.authMiddleware, quickbooksController_1.syncQBInvoices);
router.delete('/disconnect', auth_1.authMiddleware, quickbooksController_1.disconnectQB);
exports.default = router;
