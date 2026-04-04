import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import * as UserDB from '../db/users';
import * as CompanyDB from '../db/companies';
import * as AuditDB from '../db/auditLogs';
import * as BillingDB from '../db/billing';
import * as TeamDB from '../db/team';
import * as SecurityDB from '../db/security';
import { logInfo, logError } from '../utils/logger';
import { JWTPayload, SignupInput, LoginInput, AuthResponse } from '../types/auth';
import resendService from './resendService';

class AuthService {
  async signup(input: SignupInput): Promise<AuthResponse> {
    const { companyName, email, password, timezone = 'UTC', preferredCurrency = 'USD', planCode = 'phase_0' } = input;

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
    const passwordHash = await bcrypt.hash(password, 10);

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
      planCode,
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    });

    // Generate and send OTP for email verification
    const isDev = process.env.NODE_ENV !== 'production';
    const otpCode = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await UserDB.setOTP(user.id, otpCode, otpExpires);

    if (isDev) {
      logInfo('authService', 'signup', 'DEV MODE: OTP is 123456, no email sent', { email: user.email });
    } else {
      resendService.sendOTP({ email: user.email, code: otpCode }).catch((err: any) => {
        logError('authService', 'signup', 'Failed to send OTP email', err, { email: user.email });
      });
    }

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
        emailVerified: false,
        onboardingStatus: 'active' as const,
      },
      company: {
        id: company.id,
        name: company.name,
        timezone: company.timezone,
        preferredCurrency: company.preferred_currency,
        accountType: 'paid' as const,
        pilotMode: null,
        pilotEndsAt: null,
        stripeConnected: false,
        onboarding_stage: (company as any).onboarding_stage || null,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
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

    // Check if account uses Google OAuth only (no password set)
    if (!user.password_hash || user.password_hash === '') {
      const err: any = new Error('This email uses Google Sign-In. Please continue with Google.');
      err.code = 'USE_GOOGLE';
      throw err;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens (include is_demo flag if applicable)
    const { accessToken, refreshToken } = this.generateTokens(user.id, user.company_id, user.email, user.is_demo);

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
        emailVerified: user.email_verified || false,
        onboardingStatus: user.onboarding_status || 'active',
      },
      company: {
        id: user.company_id,
        name: user.company_name,
        timezone: user.timezone,
        preferredCurrency: user.preferred_currency,
        accountType: user.account_type || 'paid',
        pilotMode: user.pilot_mode || null,
        pilotEndsAt: user.pilot_ends_at || null,
        stripeConnected: !!user.stripe_account_id,
        onboarding_stage: (user as any).onboarding_stage || null,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  async refreshToken(
    refreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    if (!config.jwtSecret || !config.refreshTokenSecret) {
      throw new Error('JWT secrets not configured');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.refreshTokenSecret) as Partial<JWTPayload>;
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

      const { accessToken, refreshToken: nextRefreshToken } = this.generateTokens(
        decoded.userId,
        decoded.companyId,
        decoded.email
      );

      await SecurityDB.rotateSession({
        oldRefreshToken: refreshToken,
        newRefreshToken: nextRefreshToken,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return { accessToken, refreshToken: nextRefreshToken };
    } catch (err) {
      if (err instanceof Error && err.message === 'Refresh token replay detected') {
        throw err;
      }
      throw new Error('Invalid refresh token');
    }
  }

  async getCurrentUser(userId: string): Promise<AuthResponse['user'] & { company: AuthResponse['company']; emailVerified: boolean; authProvider: string; passwordHash: string }> {
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
      emailVerified: user.email_verified || false,
      onboardingStatus: user.onboarding_status || 'active',
      authProvider: (user.auth_provider as any) || 'email',
      passwordHash: user.password_hash,
      company: {
        id: user.company_id,
        name: user.company_name,
        timezone: user.timezone,
        preferredCurrency: user.preferred_currency,
        accountType: user.account_type || 'paid',
        pilotMode: user.pilot_mode || null,
        pilotEndsAt: user.pilot_ends_at || null,
        stripeConnected: !!user.stripe_account_id,
        onboarding_stage: (user as any).onboarding_stage || null,
      },
    };
  }

  private generateTokens(userId: string, companyId: string, email: string, isDemo?: boolean) {
    if (!config.jwtSecret || !config.refreshTokenSecret) {
      throw new Error('JWT secrets not configured');
    }

    const payload: JWTPayload = { userId, companyId, email };
    if (isDemo) {
      payload.is_demo = true;
    }

    const accessToken = jwt.sign(
      payload,
      config.jwtSecret,
      { expiresIn: '1h' }  // Changed from 7d to 1h for security
    );

    const refreshToken = jwt.sign(
      payload,
      config.refreshTokenSecret,
      { expiresIn: '7d' }  // Changed from 30d to 7d for security
    );

    return { accessToken, refreshToken };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await UserDB.findUserByEmail(email);
    if (!user) return; // Silent fail for security

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UserDB.setResetToken(user.id, resetToken, resetExpiry);

    // Send password reset email via Resend (non-blocking)
    const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    resendService.sendEmail({
      to: email,
      subject: 'Reset your RecoverAI password',
      bodyText: `Click this link to reset your password: ${resetLink}\n\nValid for 1 hour.`,
      bodyHtml: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p><p>Valid for 1 hour.</p>`,
    }).catch((err: any) => {
      logError('authService', 'requestPasswordReset', 'Failed to send reset email', err, { email });
    });

    logInfo('authService', 'requestPasswordReset', 'Reset token generated and email sent', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const user = await UserDB.findUserByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await UserDB.updatePassword(user.id, passwordHash);
    await UserDB.clearResetToken(user.id);

    logInfo('authService', 'resetPassword', 'Password reset successful', { userId: user.id });
  }

async googleLogin(code: string): Promise<AuthResponse> {
  const { exchangeCodeForToken, verifyGoogleToken } = await import('../config/oauth');
  
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

  const email = googleUser.email as string;
  const name = (googleUser.name as string) || 'User';
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ') || 'User';

  // Find existing user with this email
  let user = await UserDB.findUserWithCompanyByEmail(email);
  const avatarUrl = (googleUser.picture as string) || undefined;

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
      googleId: googleUser.sub as string,
      authProvider: 'google',
      avatarUrl,
    });

    // Set company owner
    await CompanyDB.setCompanyOwner(company.id, newUser.id);
    await TeamDB.ensureOwnerMembership(company.id, newUser.id);
    await BillingDB.ensureDefaultPlans();
    await BillingDB.upsertCompanySubscription({
      companyId: company.id,
      planCode: 'phase_0',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
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
  } else {
    // Existing user - link Google account if not already linked
    if (!user.google_id) {
      // Account linking: email/password user linking with Google
      await UserDB.updateGoogleId(user.id, googleUser.sub as string, 'both', avatarUrl);

      // Audit log
      await AuditDB.createAuditLog({
        companyId: user.company_id,
        userId: user.id,
        action: 'UPDATE',
        resourceType: 'user',
        details: { email, method: 'google_oauth_link' },
      });
    }

    // Update last login
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
      emailVerified: user.email_verified || true,
      onboardingStatus: (user.onboarding_status || 'active') as string,
    },
    company: {
      id: user.company_id,
      name: user.company_name,
      timezone: user.timezone,
      preferredCurrency: user.preferred_currency,
      accountType: (user.account_type || 'paid') as 'pilot' | 'paid',
      pilotMode: (user.pilot_mode || null) as 'shadow' | 'auto' | 'paused' | null,
      pilotEndsAt: user.pilot_ends_at || null,
      stripeConnected: !!user.stripe_account_id,
      onboarding_stage: (user as any).onboarding_stage || null,
    },
    tokens: { accessToken, refreshToken },
  };
}

  /**
   * Public method to generate auth tokens (for use in onboarding)
   */
  public createAuthTokens(userId: string, companyId: string, email: string, isDemo?: boolean) {
    return this.generateTokens(userId, companyId, email, isDemo);
  }
}

export const authService = new AuthService();
