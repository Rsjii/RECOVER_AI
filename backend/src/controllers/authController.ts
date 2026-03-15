import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { SignupInput, LoginInput } from '../types/auth';
import { config } from '../config/env';
import * as SecurityDB from '../db/security';
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
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: sameSitePolicy as any,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh', // Only sent to refresh endpoint
  });
};

const clearCookies = (res: Response) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
};

// ============ Handlers ============

export const signup = async (req: Request, res: Response) => {
  const handler = 'signup';
  const startTime = Date.now();

  try {
    const input: SignupInput = req.body;
    logInfo(handler, 'Request received', { email: input.email, companyName: input.companyName });

    // Quick validation before hitting service
    if (!input.email || !input.companyName || !input.password) {
      logInfo(handler, 'Validation failed — missing fields');
      return res.status(400).json({ error: 'Missing required fields: companyName, email, password' });
    }

    const result = await authService.signup(input);
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
    if (!userId || !companyId) {
      return sendErrorResponse(res, 401, 'Not authenticated');
    }
    const sessions = await SecurityDB.listActiveSessions(userId, companyId);
    return res.status(200).json({ data: sessions });
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
    return res.status(200).json({ message: 'Session revoked' });
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
