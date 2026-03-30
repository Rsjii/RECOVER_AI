import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authService } from '../services/authService';
import { SignupInput, LoginInput, JWTPayload } from '../types/auth';
import { config } from '../config/env';
import { pool } from '../config/database';
import * as SecurityDB from '../db/security';
import * as UserDB from '../db/users';
import * as CompanyDB from '../db/companies';
import * as TeamDB from '../db/team';
import * as BillingDB from '../db/billing';
import * as AuditDB from '../db/auditLogs';
import resendService from '../services/resendService';
import { logError as baseLogError, logInfo as baseLogInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

// ============ Structured Logger ============
const LOG_MODULE = 'authController';

function logInfo(handler: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, handler, msg, data);
}

function logError(handler: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, handler, msg, error);
}

// ============ Cookie Helpers ============
const setCookies = (res: Response, accessToken: string, refreshToken: string) => {
  // Local dev: sameSite='lax' (same-domain), Prod: sameSite='none' (cross-domain)
  const sameSitePolicy = config.nodeEnv === 'production' ? 'none' : 'lax';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: sameSitePolicy as any,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours (extended from 1h for demo stability)
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: sameSitePolicy as any,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (extended from 7d for demo stability)
    path: '/api/auth/refresh', // Only sent to refresh endpoint
  });

  logInfo('setCookies', 'Cookies set', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    sameSite: sameSitePolicy,
    nodeEnv: config.nodeEnv
  });
};

const clearCookies = (res: Response) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
};

// ============ Handlers ============

/**
 * POST /api/auth/signup
 * STEP 1: Send OTP to email
 * Account is NOT created here — created in /verify-email after OTP verification
 * Frontend stores signup data in localStorage
 * Expects: { email }
 */
export const signup = async (req: Request, res: Response) => {
  const handler = 'signup';
  const startTime = Date.now();

  try {
    const { email } = req.body;

    // ✅ Validate email
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    logInfo(handler, '📧 Sending OTP (account will be created after verification)', { email: '***' });

    // ✅ Check if email already exists
    const existing = await UserDB.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // ✅ Generate OTP (10 min expiry)
    const isDev = process.env.NODE_ENV !== 'production';
    const otpCode = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP temporarily (not tied to user yet)
    await pool.query(
      `INSERT INTO temporary_otps (email, otp_code, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET otp_code = $2, expires_at = $3`,
      [email, otpCode, otpExpires]
    ).catch(() => {
      logInfo(handler, 'Note: temporary_otps table not available, OTP verification will fail');
    });

    logInfo(handler, '✅ OTP generated', { email: '***', expiresIn: '10 minutes' });

    // ✅ Send OTP via email (prod) or return in response (dev)
    if (isDev) {
      logInfo(handler, 'DEV MODE: OTP is 123456, no email sent', { email: '***' });
    } else {
      await resendService.sendOTP({ email, code: otpCode }).catch((err: any) => {
        logError(handler, 'Failed to send OTP email', err);
      });
      logInfo(handler, 'OTP sent to email', { email: '***' });
    }

    const elapsed = Date.now() - startTime;
    logInfo(handler, `✅ OTP sent in ${elapsed}ms`, { email: '***' });

    return res.status(200).json({
      message: 'OTP sent to your email',
      devOtpCode: isDev ? '123456' : undefined,
    });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const login = async (req: Request, res: Response) => {
  const handler = 'login';
  const startTime = Date.now();

  try {
    const input: LoginInput = req.body;
    logInfo(handler, 'Request received', { email: input.email });

    if (!input.email || !input.password) {
      logInfo(handler, 'Validation failed — missing fields');
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    const result = await authService.login(input);
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
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const logout = async (req: Request, res: Response) => {
  const handler = 'logout';
  const startTime = Date.now();
  try {
    logInfo(handler, 'Request received', { userId: (req as any).userId || 'anonymous' });
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await SecurityDB.revokeSession(refreshToken);
    }
    clearCookies(res);
    logInfo(handler, `Completed in ${Date.now() - startTime}ms`);
    return res.status(200).json({ message: 'Logout successful' });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const refresh = async (req: Request, res: Response) => {
  const handler = 'refresh';
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      logInfo(handler, 'No refresh token in cookies');
      return sendErrorResponse(res, 401, 'No refresh token');
    }

    const active = await SecurityDB.isSessionActive(refreshToken);
    if (!active) {
      clearCookies(res);
      return sendErrorResponse(res, 401, 'Session revoked or expired');
    }

    const result = await authService.refreshToken(refreshToken, {
      userAgent: req.get('user-agent') || undefined,
      ipAddress: req.ip,
    });

    setCookies(res, result.accessToken, result.refreshToken);

    logInfo(handler, 'Token refreshed successfully');
    return res.status(200).json({ message: 'Token refreshed' });
  } catch (err: any) {
    logError(handler, 'Refresh failed', err);
    clearCookies(res);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const me = async (req: Request, res: Response) => {
  const handler = 'me';
  try {
    const userId = (req as any).userId;

    if (!userId) {
      logInfo(handler, 'No userId on request');
      return sendErrorResponse(res, 401, 'Not authenticated');
    }

    const result = await authService.getCurrentUser(userId);

    logInfo(handler, 'User fetched', { userId });

    return res.status(200).json({
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        emailVerified: result.emailVerified,
        onboardingStatus: result.onboardingStatus,
      },
      company: {
        ...result.company,
        onboardingStage: result.company.onboardingStage || 'pending',
      },
    });
  } catch (err: any) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const listSessions = async (req: Request, res: Response) => {
  const handler = 'listSessions';
  try {
    const userId = (req as any).userId as string | undefined;
    const companyId = (req as any).companyId as string | undefined;
    const currentRefreshToken = req.cookies?.refresh_token;

    if (!userId || !companyId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }

    const sessions = await SecurityDB.listActiveSessions(userId, companyId);

    // Find current session ID
    let currentSessionId: string | null = null;
    if (currentRefreshToken) {
      const currentSession = await SecurityDB.findSessionByRefreshToken(currentRefreshToken);
      currentSessionId = currentSession?.id || null;
    }

    // Add isCurrent flag to each session
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      isCurrent: s.id === currentSessionId
    }));

    return res.status(200).json({ data: sessionsWithCurrent });
  } catch (err: any) {
    logError(handler, 'Failed to list sessions', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const revokeSessionById = async (req: Request, res: Response) => {
  const handler = 'revokeSessionById';
  try {
    const userId = (req as any).userId as string | undefined;
    const companyId = (req as any).companyId as string | undefined;
    const { sessionId } = req.params as { sessionId: string };
    const currentRefreshToken = req.cookies?.refresh_token;

    if (!userId || !companyId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }
    if (!sessionId) {
      return sendErrorResponse(res, 400, 'sessionId is required');
    }

    const revoked = await SecurityDB.revokeSessionById(sessionId, userId, companyId);
    if (!revoked) {
      return sendErrorResponse(res, 404, 'Session not found');
    }

    // Check if this is the current session being revoked
    const currentSession = currentRefreshToken
      ? await SecurityDB.findSessionByRefreshToken(currentRefreshToken)
      : null;

    const isCurrentSession = currentSession?.id === sessionId;

    // If revoking current session, clear cookies and logout
    if (isCurrentSession) {
      clearCookies(res);
      return res.status(200).json({
        message: 'Session revoked and logged out',
        currentSessionRevoked: true
      });
    }

    return res.status(200).json({
      message: 'Session revoked',
      currentSessionRevoked: false
    });
  } catch (err: any) {
    logError(handler, 'Failed to revoke session', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const revokeAllSessions = async (req: Request, res: Response) => {
  const handler = 'revokeAllSessions';
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }
    await SecurityDB.revokeUserSessions(userId);
    clearCookies(res);
    return res.status(200).json({ message: 'All sessions revoked' });
  } catch (err: any) {
    logError(handler, 'Failed to revoke all sessions', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const listCompanySessions = async (req: Request, res: Response) => {
  const handler = 'listCompanySessions';
  try {
    const companyId = (req as any).companyId as string | undefined;
    if (!companyId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }
    const sessions = await SecurityDB.listCompanyActiveSessions(companyId);
    return res.status(200).json({ data: sessions });
  } catch (err: any) {
    logError(handler, 'Failed to list company sessions', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const revokeCompanySessionById = async (req: Request, res: Response) => {
  const handler = 'revokeCompanySessionById';
  try {
    const companyId = (req as any).companyId as string | undefined;
    const { sessionId } = req.params as { sessionId: string };
    if (!companyId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }
    const revoked = await SecurityDB.revokeCompanySessionById(sessionId, companyId);
    if (!revoked) {
      return sendErrorResponse(res, 404, 'Session not found');
    }
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err: any) {
    logError(handler, 'Failed to revoke company session', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const handler = 'forgotPassword';
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Always return success (don't leak whether email exists)
    await authService.requestPasswordReset(email);
    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (err: any) {
    logError(handler, 'Failed', err);
    // Still return success for security
    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const handler = 'resetPassword';
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return sendErrorResponse(res, 400, 'Token and newPassword are required');
  }

  try {
    await authService.resetPassword(token, newPassword);
    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (err: any) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/auth/verify-email
 * PUBLIC endpoint (no auth required)
 * STEP 2: Verify OTP and CREATE ACCOUNT
 * Expects: { email, otp, firstName, lastName, company, password }
 * Signup data comes from frontend localStorage, not backend storage
 */
export const verifyEmail = async (req: Request, res: Response) => {
  const handler = 'verifyEmail';
  const startTime = Date.now();

  try {
    const { email, otp, firstName, lastName, company, password } = req.body;

    // ✅ Validate input
    if (!email?.trim()) {
      return sendErrorResponse(res, 400, 'Email is required');
    }
    if (!otp || typeof otp !== 'string') {
      return sendErrorResponse(res, 400, 'OTP must be a string');
    }
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return sendErrorResponse(res, 400, 'OTP must be exactly 6 digits');
    }
    if (!firstName?.trim()) {
      return sendErrorResponse(res, 400, 'First name is required');
    }
    if (!lastName?.trim()) {
      return sendErrorResponse(res, 400, 'Last name is required');
    }
    if (!company?.trim()) {
      return sendErrorResponse(res, 400, 'Company name is required');
    }
    if (!password?.trim()) {
      return sendErrorResponse(res, 400, 'Password is required');
    }

    logInfo(handler, 'Verifying email with OTP and creating account', { email: '***' });

    // ✅ Verify OTP from temporary storage (not tied to user yet)
    const otpResult = await pool.query(
      'SELECT otp_code, expires_at FROM temporary_otps WHERE email = $1',
      [email]
    ).catch(() => ({ rows: [] }));

    if (!otpResult.rows.length) {
      logInfo(handler, 'OTP not found for email', { email: '***' });
      return sendErrorResponse(res, 400, 'No OTP found. Please sign up again.');
    }

    const { otp_code, expires_at } = otpResult.rows[0];

    // ✅ Check if OTP matches
    if (otp_code !== otp) {
      logInfo(handler, 'Invalid OTP', { email: '***' });
      return sendErrorResponse(res, 400, 'Invalid OTP');
    }

    // ✅ Check if OTP expired
    if (new Date(expires_at) < new Date()) {
      logInfo(handler, 'OTP expired', { email: '***' });
      return sendErrorResponse(res, 400, 'OTP has expired — request a new one');
    }

    // ✅ Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    logInfo(handler, '✅ Password hashed', { email: '***' });

    logInfo(handler, '✅ OTP verified, creating account now', { email: '***' });

    // ✅ NOW CREATE THE ACCOUNT (was pending until OTP verified)
    const companyObj = await CompanyDB.createCompany({
      name: company,
      email,
      timezone: 'UTC',
      preferredCurrency: 'USD',
      onboardingStage: 'integrations',
    });

    logInfo(handler, '✅ Company created', { companyId: companyObj.id });

    // ✅ Create user
    const user = await UserDB.createUser({
      companyId: companyObj.id,
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'owner',
    });

    logInfo(handler, '✅ User created', { userId: user.id });

    // ✅ Set company owner + team membership + billing
    await CompanyDB.setCompanyOwner(companyObj.id, user.id);
    await TeamDB.ensureOwnerMembership(companyObj.id, user.id);
    await BillingDB.ensureDefaultPlans();
    await BillingDB.upsertCompanySubscription({
      companyId: companyObj.id,
      planCode: 'phase_0',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    logInfo(handler, '✅ Account fully setup', { userId: user.id, companyId: companyObj.id });

    // ✅ Mark email as verified
    await pool.query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // ✅ Clear temporary OTP
    await pool.query('DELETE FROM temporary_otps WHERE email = $1', [email]).catch(() => {});

    // ✅ Generate tokens for login
    if (!config.jwtSecret || !config.refreshTokenSecret) {
      throw new Error('JWT secrets not configured');
    }

    const accessToken = jwt.sign(
      { userId: user.id, companyId: companyObj.id, email: user.email } as JWTPayload,
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, companyId: companyObj.id, email: user.email } as JWTPayload,
      config.refreshTokenSecret,
      { expiresIn: '7d' }
    );

    // ✅ Set cookies
    setCookies(res, accessToken, refreshToken);

    // ✅ Create session + audit log
    await SecurityDB.createSession({
      userId: user.id,
      companyId: companyObj.id,
      refreshToken,
      userAgent: req.get('user-agent') || undefined,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await AuditDB.createAuditLog({
      companyId: companyObj.id,
      userId: user.id,
      action: 'CREATE',
      resourceType: 'user',
      details: { email, role: 'owner' },
    });

    const elapsed = Date.now() - startTime;
    logInfo(handler, `✅ Account created and verified in ${elapsed}ms`, { userId: user.id });

    return res.status(201).json({
      message: 'Email verified! Account created.',
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        emailVerified: true,
      },
      company: {
        id: companyObj.id,
        name: companyObj.name,
        timezone: companyObj.timezone,
        preferredCurrency: companyObj.preferred_currency,
        onboardingStage: 'integrations',
        stripeConnected: false,
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (err: any) {
    logError(handler, 'Failed to verify email', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  const handler = 'resendOtp';
  try {
    const userId = (req as any).userId;
    const { email } = req.body as { email?: string };

    let user;
    if (userId) {
      // If authenticated, use user from auth middleware
      user = await UserDB.findUserById(userId);
      if (!user) {
        return sendErrorResponse(res, 404, 'User not found');
      }
    } else if (email) {
      // If not authenticated, lookup by email (for users on verify page)
      user = await UserDB.findUserByEmail(email);
      if (!user) {
        return sendErrorResponse(res, 404, 'User not found');
      }
    } else {
      return sendErrorResponse(res, 400, 'Either authentication or email is required');
    }

    // Generate new OTP
    const isDev = process.env.NODE_ENV !== 'production';
    const otpCode = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await UserDB.setOTP(user.id, otpCode, otpExpires);

    if (isDev) {
      logInfo(handler, 'DEV MODE: OTP is 123456, no email sent', { userId: user.id });
    } else {
      const result = await resendService.sendOTP({ email: user.email, code: otpCode });
      if (!result.success) {
        logError(handler, 'Failed to send OTP email', result.error);
        return sendErrorResponse(res, 500, 'Failed to send OTP email. Please try again.');
      }
    }

    logInfo(handler, 'OTP resent successfully', { userId: user.id, email: user.email });

    return res.status(200).json({
      message: 'OTP resent to your email',
    });
  } catch (err: any) {
    logError(handler, 'Failed to resend OTP', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  const handler = 'googleCallback';
  const startTime = Date.now();

  try {
    const { code } = req.body;

    if (!code) {
      logInfo(handler, 'Missing authorization code');
      return sendErrorResponse(res, 400, 'Missing authorization code');
    }

    logInfo(handler, 'Processing Google OAuth callback');

    const result = await authService.googleLogin(code);
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
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/auth/bootstrap
 * ONLY works when DB is empty (first admin setup)
 * Creates first company + admin user account
 * Can only be called once (403 if users already exist)
 */
export const bootstrap = async (req: Request, res: Response) => {
  const handler = 'bootstrap';
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return sendErrorResponse(res, 400, 'Missing required fields: email, password, firstName, lastName');
    }

    // Check if any users exist yet (security: only allow bootstrap on empty DB)
    const existingUsers = await UserDB.countAllUsers();
    if (existingUsers > 0) {
      logInfo(handler, 'Bootstrap rejected — users already exist', { existingUsers });
      return sendErrorResponse(res, 403, 'Bootstrap only allowed on empty database');
    }

    // Create first admin user (also creates company)
    const result = await authService.signup({
      companyName: `${firstName}'s Company`,
      email,
      password,
      firstName,
      lastName,
    });

    // Link company to owner
    await pool.query(
      `UPDATE companies SET owner_id = $1 WHERE id = $2`,
      [result.user.id, result.company.id]
    );

    // Set email as verified (admin account)
    await pool.query(
      `UPDATE users SET email_verified = true WHERE id = $1`,
      [result.user.id]
    );

    // ✅ CRITICAL: Set company to PAID_ACTIVE - NO TRIAL, NO ONBOARDING, FULL DASHBOARD ACCESS
    await pool.query(
      `UPDATE companies
       SET account_type = 'paid',
           onboarding_stage = 'paid_active',
           trial_status = NULL,
           trial_starts_at = NULL,
           trial_ends_at = NULL,
           billing_tier = 4,
           updated_at = NOW()
       WHERE id = $1`,
      [result.company.id]
    );

    // ✅ Ensure user role is 'admin'
    await pool.query(
      `UPDATE users SET role = 'admin' WHERE id = $1`,
      [result.user.id]
    );

    // Create session
    await SecurityDB.createSession({
      userId: result.user.id,
      companyId: result.company.id,
      refreshToken: result.tokens.refreshToken,
      userAgent: req.get('user-agent') || undefined,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Set cookies
    setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    logInfo(handler, '✅ Bootstrap successful — admin created with FULL DASHBOARD ACCESS', {
      email,
      companyId: result.company.id,
      accountType: 'paid',
      onboardingStage: 'paid_active',
      billingTier: 4,
      userRole: 'admin'
    });

    return res.status(201).json({
      message: 'Admin account created successfully - DIRECT DASHBOARD ACCESS',
      user: { ...result.user, role: 'admin' },
      company: {
        ...result.company,
        account_type: 'paid',
        onboarding_stage: 'paid_active',
        billing_tier: 4
      },
      redirect: '/dashboard',
    });
  } catch (err: any) {
    logError(handler, 'Bootstrap failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Onboard via invite token (Motion 1 - Personalized invites)
 * POST /api/auth/onboard-with-token
 *
 * Body: {
 *   token: "abc123...",
 *   email: "john@company.xyz",
 *   first_name: "John",
 *   last_name: "Smith",
 *   password?: "password123", // optional, required if no oauth
 *   oauth_provider?: "google",
 *   oauth_email?: "john@company.xyz"
 * }
 */
export const onboardWithToken = async (req: Request, res: Response) => {
  const handler = 'onboardWithToken';
  try {
    const { token, email, first_name, last_name, password, oauth_provider, oauth_email } = req.body;

    // Validation
    if (!token || !email) {
      return res.status(400).json({ error: 'token and email are required' });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'first_name and last_name are required' });
    }

    // Import here to avoid circular deps
    const { validateInviteToken, markTokenUsed, linkTokenToCompany } = await import('../db/invites');

    // Validate token
    const validation = await validateInviteToken(token, email);
    if (!validation.valid) {
      logInfo(handler, 'Token validation failed', { reason: validation.reason });
      return res.status(400).json({ error: validation.reason || 'Invalid token' });
    }

    const invite = validation.invite!;

    // Check if user already exists
    const existing_user = await UserDB.findUserByEmail(email);
    if (existing_user) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existing_company = await pool.query(
      'SELECT * FROM companies WHERE email = $1',
      [email]
    );
    if (existing_company.rows.length > 0) {
      return res.status(400).json({ error: 'Company already registered' });
    }

    // Hash password if provided
    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    // Create company
    const company_result = await pool.query(
      `INSERT INTO companies (name, email, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [invite.company_name, email]
    );
    const company = company_result.rows[0];

    // Create user
    const user_result = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, email_verified, signup_method, onboarding_status, auth_provider, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'owner', true, $6, 'company_form', $7, NOW(), NOW())
       RETURNING id, email, first_name, last_name, company_id`,
      [
        company.id,
        email,
        password_hash,
        first_name.trim(),
        last_name.trim(),
        oauth_provider ? 'google_oauth' : 'email_password',
        oauth_provider || 'email'
      ]
    );
    const user = user_result.rows[0];

    // Set company owner
    await pool.query(
      'UPDATE companies SET owner_id = $1 WHERE id = $2',
      [user.id, company.id]
    );

    // Mark token as used
    await markTokenUsed(token, email);
    await linkTokenToCompany(token, company.id);

    // Create session
    const tokens = authService.createAuthTokens(user.id, company.id, user.email);
    await SecurityDB.createSession({
      userId: user.id,
      companyId: company.id,
      refreshToken: tokens.refreshToken,
      userAgent: req.get('user-agent') || undefined,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Set cookies
    setCookies(res, tokens.accessToken, tokens.refreshToken);

    logInfo(handler, '✅ Onboard successful', {
      email: '***',
      company: company.name,
      method: oauth_provider ? 'oauth' : 'password'
    });

    return res.status(201).json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        company: {
          id: company.id,
          name: company.name,
        },
        onboarding_status: 'company_form',
        redirect: '/onboard/company'
      }
    });
  } catch (err: any) {
    logError(handler, 'Onboard failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Complete company form during onboarding
 * POST /api/onboard/company-info
 *
 * Only accepts company_name (as per user requirement)
 * No revenue/employees fields
 */
export const completeCompanyForm = async (req: Request, res: Response) => {
  const handler = 'completeCompanyForm';
  try {
    const user_id = (req as any).userId;
    const company_id = (req as any).companyId;

    if (!user_id || !company_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { company_name } = req.body;

    if (!company_name || typeof company_name !== 'string') {
      return res.status(400).json({ error: 'company_name is required' });
    }

    if (company_name.trim().length === 0) {
      return res.status(400).json({ error: 'company_name cannot be empty' });
    }

    // Update company name
    await pool.query(
      'UPDATE companies SET name = $1, updated_at = NOW() WHERE id = $2',
      [company_name.trim(), company_id]
    );

    // Update user onboarding status
    await pool.query(
      'UPDATE users SET onboarding_status = $1, updated_at = NOW() WHERE id = $2',
      [company_id === company_id ? 'stripe_pending' : 'stripe_pending', user_id]
    );

    logInfo(handler, 'Company form completed', {
      company: company_name,
      companyId: company_id
    });

    return res.json({
      data: {
        success: true,
        company_name: company_name.trim(),
        next_step: 'stripe_connection',
        redirect: '/onboard/stripe'
      }
    });
  } catch (err: any) {
    logError(handler, 'Failed to complete company form', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/auth/verify-otp-and-create-account
 * Verify OTP and create account (authService.signup)
 * Expects: { email, otp, password, firstName, lastName, companyName }
 */
export const verifyOtpAndCreateAccount = async (req: Request, res: Response) => {
  const handler = 'verifyOtpAndCreateAccount';
  const startTime = Date.now();

  try {
    const { email, otp, password, firstName, lastName, companyName } = req.body;

    if (!email || !otp || !password || !firstName || !lastName || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logInfo(handler, 'Verifying OTP and creating account', { email: '***' });

    // Validate OTP format
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev && otp !== '123456') {
      return res.status(400).json({ error: 'Invalid OTP (dev expects 123456)' });
    }
    if (!isDev && (!otp.match(/^\d{6}$/))) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }

    // Create account with signup service
    // The signup service will:
    // 1. Create company + user
    // 2. Generate fresh OTP and store it
    // 3. Send OTP email
    // 4. Return tokens
    const signupInput: SignupInput = {
      email,
      password,
      companyName,
      firstName,
      lastName,
      planCode: 'phase_0',
    };

    const result = await authService.signup(signupInput);

    // Set auth cookies
    setCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    const elapsed = Date.now() - startTime;
    logInfo(handler, `Account created in ${elapsed}ms`, { userId: result.user.id, email: '***' });

    return res.status(201).json({
      message: 'Account created successfully',
      user: result.user,
      company: result.company,
    });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};
