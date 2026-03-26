import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { SignupInput, LoginInput } from '../types/auth';
import { config } from '../config/env';
import { pool } from '../config/database';
import * as SecurityDB from '../db/security';
import * as UserDB from '../db/users';
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

export const signup = async (req: Request, res: Response) => {
  // Signup disabled - pilot program only
  // Users must apply via /api/pilots/request to join
  logInfo('signup', 'Signup disabled', { email: req.body.email });
  return res.status(403).json({
    code: 'SIGNUP_DISABLED',
    error: 'Sign up is disabled. Please apply for our pilot program at /landing',
  });
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
      },
      company: result.company,
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

export const verifyEmail = async (req: Request, res: Response) => {
  const handler = 'verifyEmail';
  try {
    const { otp } = req.body;
    const userId = (req as any).userId as string | undefined;

    if (!otp || typeof otp !== 'string') {
      return sendErrorResponse(res, 400, 'OTP must be a string');
    }
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return sendErrorResponse(res, 400, 'OTP must be exactly 6 digits');
    }

    let user;
    if (userId) {
      // Preferred: authenticated user — verify their specific OTP
      user = await UserDB.findUserById(userId);
      if (!user) return sendErrorResponse(res, 404, 'User not found');
      if (user.otp_code !== otp) {
        logInfo(handler, 'Invalid OTP', { userId });
        return sendErrorResponse(res, 400, 'Invalid or expired OTP');
      }
      if (!user.otp_expires || new Date(user.otp_expires) < new Date()) {
        logInfo(handler, 'OTP expired', { userId });
        return sendErrorResponse(res, 400, 'OTP has expired — request a new one');
      }
    } else {
      // Fallback: unauthenticated (edge case) — find by OTP
      user = await UserDB.findUserByOTP(otp);
      if (!user) {
        logInfo(handler, 'Invalid or expired OTP (no auth context)');
        return sendErrorResponse(res, 400, 'Invalid or expired OTP');
      }
    }

    // Clear OTP and mark email as verified
    await UserDB.clearOTP(user.id);

    logInfo(handler, 'Email verified successfully', { userId: user.id });

    return res.status(200).json({ message: 'Email verified successfully', verified: true });
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

    logInfo(handler, '✅ Bootstrap successful — first admin created', { email, companyId: result.company.id });

    return res.status(201).json({
      message: 'Admin account created successfully',
      user: result.user,
      company: result.company,
    });
  } catch (err: any) {
    logError(handler, 'Bootstrap failed', err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};
