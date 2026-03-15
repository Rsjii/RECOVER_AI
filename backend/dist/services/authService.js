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
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const UserDB = __importStar(require("../db/users"));
const CompanyDB = __importStar(require("../db/companies"));
const AuditDB = __importStar(require("../db/auditLogs"));
const BillingDB = __importStar(require("../db/billing"));
const TeamDB = __importStar(require("../db/team"));
const SecurityDB = __importStar(require("../db/security"));
const logger_1 = require("../utils/logger");
class AuthService {
    async signup(input) {
        const { companyName, email, password, timezone = 'UTC', preferredCurrency = 'USD' } = input;
        // Validation
        if (!companyName || !email || !password) {
            throw new Error('Missing required fields: companyName, email, password');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }
        // Check if email exists
        const existing = await CompanyDB.findCompanyByEmail(email);
        if (existing) {
            throw new Error('Email already registered');
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create company
        const company = await CompanyDB.createCompany({
            name: companyName,
            email,
            timezone,
            preferredCurrency,
        });
        // Create user
        const user = await UserDB.createUser({
            companyId: company.id,
            email,
            passwordHash,
            firstName: input.firstName?.trim() || 'Owner',
            lastName: input.lastName?.trim() || 'User',
            role: 'owner',
        });
        // Set company owner
        await CompanyDB.setCompanyOwner(company.id, user.id);
        await TeamDB.ensureOwnerMembership(company.id, user.id);
        await BillingDB.ensureDefaultPlans();
        await BillingDB.upsertCompanySubscription({
            companyId: company.id,
            planCode: 'starter',
            status: 'trialing',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
        // Generate tokens
        const { accessToken, refreshToken } = this.generateTokens(user.id, company.id, user.email);
        // Audit log
        await AuditDB.createAuditLog({
            companyId: company.id,
            userId: user.id,
            action: 'CREATE',
            resourceType: 'user',
            details: { email, role: 'owner' },
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
            company: {
                id: company.id,
                name: company.name,
                timezone: company.timezone,
                preferredCurrency: company.preferred_currency,
            },
            tokens: { accessToken, refreshToken },
        };
    }
    async login(input) {
        const { email, password } = input;
        // Validation
        if (!email || !password) {
            throw new Error('Missing required fields: email, password');
        }
        // Find user with company
        const user = await UserDB.findUserWithCompanyByEmail(email);
        if (!user) {
            throw new Error('Invalid email or password');
        }
        // Check if active
        if (!user.is_active) {
            throw new Error('Account is disabled');
        }
        // Verify password
        const isValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid email or password');
        }
        // Generate tokens
        const { accessToken, refreshToken } = this.generateTokens(user.id, user.company_id, user.email);
        // Update last login
        await UserDB.updateLastLogin(user.id);
        // Audit log
        await AuditDB.createAuditLog({
            companyId: user.company_id,
            userId: user.id,
            action: 'LOGIN',
            resourceType: 'session',
            details: { email },
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
            company: {
                id: user.company_id,
                name: user.company_name,
                timezone: user.timezone,
                preferredCurrency: user.preferred_currency,
            },
            tokens: { accessToken, refreshToken },
        };
    }
    async refreshToken(refreshToken, metadata) {
        if (!refreshToken) {
            throw new Error('No refresh token');
        }
        if (!env_1.config.jwtSecret || !env_1.config.refreshTokenSecret) {
            throw new Error('JWT secrets not configured');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.config.refreshTokenSecret);
            const existingSession = await SecurityDB.findSessionByRefreshToken(refreshToken);
            if (!existingSession) {
                throw new Error('Invalid refresh token');
            }
            if (existingSession.revoked_at || new Date(existingSession.expires_at) <= new Date()) {
                await SecurityDB.revokeUserSessionsForRefreshToken(refreshToken);
                throw new Error('Refresh token replay detected');
            }
            if (!decoded.userId || !decoded.companyId || !decoded.email) {
                throw new Error('Invalid refresh token');
            }
            const { accessToken, refreshToken: nextRefreshToken } = this.generateTokens(decoded.userId, decoded.companyId, decoded.email);
            await SecurityDB.rotateSession({
                oldRefreshToken: refreshToken,
                newRefreshToken: nextRefreshToken,
                userAgent: metadata?.userAgent,
                ipAddress: metadata?.ipAddress,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });
            return { accessToken, refreshToken: nextRefreshToken };
        }
        catch (err) {
            if (err instanceof Error && err.message === 'Refresh token replay detected') {
                throw err;
            }
            throw new Error('Invalid refresh token');
        }
    }
    async getCurrentUser(userId) {
        const user = await UserDB.findUserWithCompany(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            company: {
                id: user.company_id,
                name: user.company_name,
                timezone: user.timezone,
                preferredCurrency: user.preferred_currency,
            },
        };
    }
    generateTokens(userId, companyId, email) {
        if (!env_1.config.jwtSecret || !env_1.config.refreshTokenSecret) {
            throw new Error('JWT secrets not configured');
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId, companyId, email }, env_1.config.jwtSecret, { expiresIn: '1h' } // Changed from 7d to 1h for security
        );
        const refreshToken = jsonwebtoken_1.default.sign({ userId, companyId, email }, env_1.config.refreshTokenSecret, { expiresIn: '7d' } // Changed from 30d to 7d for security
        );
        return { accessToken, refreshToken };
    }
    async requestPasswordReset(email) {
        const user = await UserDB.findUserByEmail(email);
        if (!user)
            return; // Silent fail for security
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await UserDB.setResetToken(user.id, resetToken, resetExpiry);
        // TODO: Send email via SendGrid with reset link
        // For now, just log it
        (0, logger_1.logInfo)('authService', 'requestPasswordReset', 'Reset token generated', { email });
    }
    async resetPassword(token, newPassword) {
        if (newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }
        const user = await UserDB.findUserByResetToken(token);
        if (!user) {
            throw new Error('Invalid or expired reset token');
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await UserDB.updatePassword(user.id, passwordHash);
        await UserDB.clearResetToken(user.id);
        (0, logger_1.logInfo)('authService', 'resetPassword', 'Password reset successful', { userId: user.id });
    }
    async googleLogin(code) {
        const { exchangeCodeForToken, verifyGoogleToken } = await Promise.resolve().then(() => __importStar(require('../config/oauth')));
        // Exchange auth code for tokens
        const tokens = await exchangeCodeForToken(code);
        if (!tokens.id_token) {
            throw new Error('No ID token from Google');
        }
        // Verify and decode ID token
        const googleUser = await verifyGoogleToken(tokens.id_token);
        if (!googleUser || !googleUser.email) {
            throw new Error('Invalid Google token');
        }
        const email = googleUser.email;
        const name = googleUser.name || 'User';
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ') || 'User';
        // Find existing user with this email
        let user = await UserDB.findUserWithCompanyByEmail(email);
        if (!user) {
            // New user - create company + user
            const company = await CompanyDB.createCompany({
                name: `${firstName}'s Company`,
                email,
                timezone: 'UTC',
                preferredCurrency: 'USD',
            });
            const newUser = await UserDB.createUser({
                companyId: company.id,
                email,
                passwordHash: '', // No password for OAuth users
                firstName,
                lastName,
                role: 'owner',
            });
            // Set company owner
            await CompanyDB.setCompanyOwner(company.id, newUser.id);
            await TeamDB.ensureOwnerMembership(company.id, newUser.id);
            await BillingDB.ensureDefaultPlans();
            await BillingDB.upsertCompanySubscription({
                companyId: company.id,
                planCode: 'starter',
                status: 'trialing',
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            });
            // Audit log
            await AuditDB.createAuditLog({
                companyId: company.id,
                userId: newUser.id,
                action: 'CREATE',
                resourceType: 'user',
                details: { email, method: 'google_oauth', role: 'owner' },
            });
            // Fetch with company info
            user = await UserDB.findUserWithCompany(newUser.id);
        }
        else {
            // Existing user - update last login
            await UserDB.updateLastLogin(user.id);
            // Audit log
            await AuditDB.createAuditLog({
                companyId: user.company_id,
                userId: user.id,
                action: 'LOGIN',
                resourceType: 'session',
                details: { email, method: 'google_oauth' },
            });
        }
        if (!user) {
            throw new Error('Failed to load user');
        }
        // Generate tokens
        const { accessToken, refreshToken } = this.generateTokens(user.id, user.company_id, user.email);
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
            company: {
                id: user.company_id,
                name: user.company_name,
                timezone: user.timezone,
                preferredCurrency: user.preferred_currency,
            },
            tokens: { accessToken, refreshToken },
        };
    }
}
exports.authService = new AuthService();
