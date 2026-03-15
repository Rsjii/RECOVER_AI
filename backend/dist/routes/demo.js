"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const demoController_1 = require("../controllers/demoController");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * POST /api/demo/login
 * Creates complete demo environment with test data
 * No authentication required
 * Rate limited to prevent abuse:
 * - Dev: 10000 per minute (essentially unlimited)
 * - Prod: 5 per minute
 */
router.post('/login', rateLimiter_1.demoLimiter, demoController_1.demoLogin);
/**
 * POST /api/demo/preview
 * Dry-run agent on demo data — returns what WOULD happen (no emails sent).
 * Call after /api/demo/login to show safe preview to prospects.
 */
router.post('/preview', rateLimiter_1.demoLimiter, demoController_1.demoPreview);
exports.default = router;
