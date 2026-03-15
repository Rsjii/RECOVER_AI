"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const validate_1 = require("../middleware/validate");
const schemas_1 = require("../types/schemas");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Public routes
router.post('/signup', rateLimiter_1.authLimiter, (0, validate_1.validate)(schemas_1.signupSchema), authController_1.signup);
router.post('/login', rateLimiter_1.authLimiter, (0, validate_1.validate)(schemas_1.loginSchema), authController_1.login);
router.post('/logout', authController_1.logout);
router.post('/refresh', authController_1.refresh);
router.post('/forgot-password', rateLimiter_1.authLimiter, authController_1.forgotPassword);
router.post('/reset-password', rateLimiter_1.authLimiter, authController_1.resetPassword);
router.post('/oauth/google/callback', authController_1.googleCallback);
// Protected routes
router.get('/me', auth_1.authMiddleware, authController_1.me);
router.get('/sessions', auth_1.authMiddleware, authController_1.listSessions);
router.delete('/sessions/:sessionId', auth_1.authMiddleware, authController_1.revokeSessionById);
router.post('/sessions/revoke-all', auth_1.authMiddleware, authController_1.revokeAllSessions);
router.get('/sessions/company', auth_1.authMiddleware, (0, rbac_1.requireRole)('admin'), authController_1.listCompanySessions);
router.delete('/sessions/company/:sessionId', auth_1.authMiddleware, (0, rbac_1.requireRole)('admin'), authController_1.revokeCompanySessionById);
exports.default = router;
