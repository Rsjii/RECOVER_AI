"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const LOG_MODULE = 'authMiddleware';
const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies.access_token;
        if (!token) {
            (0, logger_1.logInfo)(LOG_MODULE, 'authMiddleware', 'No access token', (0, logger_1.getRequestContext)(req));
            return res.status(401).json({ error: 'No access token' });
        }
        if (!env_1.config.jwtSecret) {
            (0, logger_1.logError)(LOG_MODULE, 'authMiddleware', 'JWT_SECRET not configured', undefined, (0, logger_1.getRequestContext)(req));
            return res.status(500).json({ error: 'Server misconfigured' });
        }
        const decoded = (0, jsonwebtoken_1.verify)(token, env_1.config.jwtSecret);
        // Attach to request object
        req.userId = decoded.userId;
        req.companyId = decoded.companyId;
        req.email = decoded.email;
        next();
    }
    catch (err) {
        const reason = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
        (0, logger_1.logInfo)(LOG_MODULE, 'authMiddleware', reason, (0, logger_1.getRequestContext)(req));
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
exports.authMiddleware = authMiddleware;
