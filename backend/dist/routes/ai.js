"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiController_1 = require("../controllers/aiController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All AI routes require authentication
router.use(auth_1.authMiddleware);
// Risk scoring
router.post('/risk-score', aiController_1.calculateRiskScore);
// Email generation
router.post('/generate-email', aiController_1.generateDunningEmail);
// Payment plan recommendation
router.post('/recommend-plan', aiController_1.recommendPaymentPlan);
exports.default = router;
