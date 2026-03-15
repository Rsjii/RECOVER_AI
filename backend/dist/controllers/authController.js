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
exports.googleCallback = exports.resetPassword = exports.forgotPassword = exports.revokeCompanySessionById = exports.listCompanySessions = exports.revokeAllSessions = exports.revokeSessionById = exports.listSessions = exports.me = exports.refresh = exports.logout = exports.login = exports.signup = void 0;
const authService_1 = require("../services/authService");
const env_1 = require("../config/env");
const SecurityDB = __importStar(require("../db/security"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
// ============ Structured Logger ============
const LOG_MODULE = 'authController';
function logInfo(handler, msg, data) {
    (0, logger_1.logInfo)(LOG_MODULE, handler, msg, data);
}
function logError(handler, msg, error) {
    (0, logger_1.logError)(LOG_MODULE, handler, msg, error);
}
// ============ Cookie Helpers ============
const setCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: env_1.config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000, // 1 hour (changed from 7 days)
    });
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: env_1.config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (changed from 30 days)
        path: '/api/auth/refresh', // Only sent to refresh endpoint
    });
};
const clearCookies = (res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
};
// ============ Handlers ============
const signup = async (req, res) => {
    const handler = 'signup';
    const startTime = Date.now();
    try {
        const input = req.body;
        logInfo(handler, 'Request received', { email: input.email, companyName: input.companyName });
        // Quick validation before hitting service
        if (!input.email || !input.companyName || !input.password) {
            logInfo(handler, 'Validation failed — missing fields');
            return res.status(400).json({ error: 'Missing required fields: companyName, email, password' });
        }
        const result = await authService_1.authService.signup(input);
        await SecurityDB.createSession({
            userId: result.user.id,
            companyId: result.company.id,
            refreshToken: result.tokens.refreshToken,
            userAgent: req.get('user-agent') || undefined,
            ipAddress: req.ip,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, { userId: result.user.id, companyId: result.company.id });
        return res.status(201).json({
            message: 'Signup successful',
            user: result.user,
            company: result.company,
        });
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.signup = signup;
const login = async (req, res) => {
    const handler = 'login';
    const startTime = Date.now();
    try {
        const input = req.body;
        logInfo(handler, 'Request received', { email: input.email });
        if (!input.email || !input.password) {
            logInfo(handler, 'Validation failed — missing fields');
            return res.status(400).json({ error: 'Missing required fields: email, password' });
        }
        const result = await authService_1.authService.login(input);
        await SecurityDB.createSession({
            userId: result.user.id,
            companyId: result.company.id,
            refreshToken: result.tokens.refreshToken,
            userAgent: req.get('user-agent') || undefined,
            ipAddress: req.ip,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, { userId: result.user.id });
        return res.status(200).json({
            message: 'Login successful',
            user: result.user,
            company: result.company,
        });
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.login = login;
const logout = async (req, res) => {
    const handler = 'logout';
    const startTime = Date.now();
    try {
        logInfo(handler, 'Request received', { userId: req.userId || 'anonymous' });
        const refreshToken = req.cookies?.refresh_token;
        if (refreshToken) {
            await SecurityDB.revokeSession(refreshToken);
        }
        clearCookies(res);
        logInfo(handler, `Completed in ${Date.now() - startTime}ms`);
        return res.status(200).json({ message: 'Logout successful' });
    }
    catch (err) {
        logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.logout = logout;
const refresh = async (req, res) => {
    const handler = 'refresh';
    try {
        const refreshToken = req.cookies.refresh_token;
        if (!refreshToken) {
            logInfo(handler, 'No refresh token in cookies');
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'No refresh token');
        }
        const active = await SecurityDB.isSessionActive(refreshToken);
        if (!active) {
            clearCookies(res);
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Session revoked or expired');
        }
        const result = await authService_1.authService.refreshToken(refreshToken, {
            userAgent: req.get('user-agent') || undefined,
            ipAddress: req.ip,
        });
        setCookies(res, result.accessToken, result.refreshToken);
        logInfo(handler, 'Token refreshed successfully');
        return res.status(200).json({ message: 'Token refreshed' });
    }
    catch (err) {
        logError(handler, 'Refresh failed', err);
        clearCookies(res);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.refresh = refresh;
const me = async (req, res) => {
    const handler = 'me';
    try {
        const userId = req.userId;
        if (!userId) {
            logInfo(handler, 'No userId on request');
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        const result = await authService_1.authService.getCurrentUser(userId);
        logInfo(handler, 'User fetched', { userId });
        return res.status(200).json({
            user: {
                id: result.id,
                email: result.email,
                firstName: result.firstName,
                lastName: result.lastName,
                role: result.role,
            },
            company: result.company,
        });
    }
    catch (err) {
        logError(handler, 'Failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.me = me;
const listSessions = async (req, res) => {
    const handler = 'listSessions';
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        if (!userId || !companyId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        const sessions = await SecurityDB.listActiveSessions(userId, companyId);
        return res.status(200).json({ data: sessions });
    }
    catch (err) {
        logError(handler, 'Failed to list sessions', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listSessions = listSessions;
const revokeSessionById = async (req, res) => {
    const handler = 'revokeSessionById';
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        const { sessionId } = req.params;
        if (!userId || !companyId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        if (!sessionId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'sessionId is required');
        }
        const revoked = await SecurityDB.revokeSessionById(sessionId, userId, companyId);
        if (!revoked) {
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Session not found');
        }
        return res.status(200).json({ message: 'Session revoked' });
    }
    catch (err) {
        logError(handler, 'Failed to revoke session', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.revokeSessionById = revokeSessionById;
const revokeAllSessions = async (req, res) => {
    const handler = 'revokeAllSessions';
    try {
        const userId = req.userId;
        if (!userId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        await SecurityDB.revokeUserSessions(userId);
        clearCookies(res);
        return res.status(200).json({ message: 'All sessions revoked' });
    }
    catch (err) {
        logError(handler, 'Failed to revoke all sessions', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.revokeAllSessions = revokeAllSessions;
const listCompanySessions = async (req, res) => {
    const handler = 'listCompanySessions';
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        const sessions = await SecurityDB.listCompanyActiveSessions(companyId);
        return res.status(200).json({ data: sessions });
    }
    catch (err) {
        logError(handler, 'Failed to list company sessions', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listCompanySessions = listCompanySessions;
const revokeCompanySessionById = async (req, res) => {
    const handler = 'revokeCompanySessionById';
    try {
        const companyId = req.companyId;
        const { sessionId } = req.params;
        if (!companyId) {
            return (0, errorHandler_1.sendErrorResponse)(res, 401, 'Not authenticated');
        }
        const revoked = await SecurityDB.revokeCompanySessionById(sessionId, companyId);
        if (!revoked) {
            return (0, errorHandler_1.sendErrorResponse)(res, 404, 'Session not found');
        }
        return res.status(200).json({ message: 'Session revoked' });
    }
    catch (err) {
        logError(handler, 'Failed to revoke company session', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.revokeCompanySessionById = revokeCompanySessionById;
const forgotPassword = async (req, res) => {
    const handler = 'forgotPassword';
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        // Always return success (don't leak whether email exists)
        await authService_1.authService.requestPasswordReset(email);
        return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
    }
    catch (err) {
        logError(handler, 'Failed', err);
        // Still return success for security
        return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const handler = 'resetPassword';
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return (0, errorHandler_1.sendErrorResponse)(res, 400, 'Token and newPassword are required');
    }
    try {
        await authService_1.authService.resetPassword(token, newPassword);
        return res.status(200).json({ message: 'Password reset successfully' });
    }
    catch (err) {
        logError(handler, 'Failed', err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.resetPassword = resetPassword;
const googleCallback = async (req, res) => {
    const handler = 'googleCallback';
    const startTime = Date.now();
    try {
        const { code } = req.body;
        if (!code) {
            logInfo(handler, 'Missing authorization code');
            return (0, errorHandler_1.sendErrorResponse)(res, 400, 'Missing authorization code');
        }
        logInfo(handler, 'Processing Google OAuth callback');
        const result = await authService_1.authService.googleLogin(code);
        await SecurityDB.createSession({
            userId: result.user.id,
            companyId: result.company.id,
            refreshToken: result.tokens.refreshToken,
            userAgent: req.get('user-agent') || undefined,
            ipAddress: req.ip,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, { userId: result.user.id });
        return res.status(200).json({
            message: 'Google login successful',
            user: result.user,
            company: result.company,
        });
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, err);
        const { statusCode, message } = (0, errorHandler_1.parseError)(err);
        return (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.googleCallback = googleCallback;
