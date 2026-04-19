import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logInfo, logError, logWarn } from '../utils/logger';
import { config } from '../config/env';
import { redisClient } from '../config/redis';
import resendService from '../services/resendService';
import * as CompanyDB from '../db/companies';
import * as UserDB from '../db/users';
import { getInviteToken, markTokenUsed, linkTokenToCompany } from '../db/invites';
import { pool } from '../config/database';

// Mirror the same cookie settings as authController.setCookies
function setAuthCookies(res: Response, userId: string, companyId: string, email: string) {
  if (!config.jwtSecret || !config.refreshTokenSecret) {
    throw new Error('JWT secrets not configured');
  }
  const sameSite = config.nodeEnv === 'production' ? 'none' : 'lax';
  const secure = config.nodeEnv === 'production';

  const accessToken = jwt.sign(
    { userId, companyId, email },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign(
    { userId, companyId, email },
    config.refreshTokenSecret,
    { expiresIn: '7d' }
  );

  res.cookie('access_token', accessToken, {
    httpOnly: true, secure, sameSite: sameSite as any,
    maxAge: 60 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, secure, sameSite: sameSite as any,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

const MODULE = 'auditStagesController';
const isDev = process.env.NODE_ENV === 'development';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * STAGE 1: Auth — Email+Password or Google OAuth
 * Token-based, no auth cookie yet
 * Email+PW → sends OTP, returns requires_otp_verification
 * Google → creates account immediately, sets cookies
 */
export const submitStage1Auth = async (req: Request, res: Response) => {
  const { token, email, password, oauth_provider } = req.body;
  const handler = 'submitStage1Auth';

  try {
    logInfo(MODULE, handler, 'Stage 1 auth submission', { token: token?.substring(0, 8), email, isDirectSignup: !token });

    // 1. Validate token (optional — if provided, it's invite flow; if not, it's direct signup)
    let invite = null;
    let companyName = email.split('@')[1] || 'My Company';

    if (token) {
      // INVITE FLOW: Token must be valid
      invite = await getInviteToken(token);
      if (!invite) {
        return res.status(400).json({ error: 'Link expired or invalid' });
      }
      // Use company name from invite
      companyName = invite.company_name || companyName;

      // Check email matches invite (if email-locked)
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ error: 'Email does not match this invite' });
      }
    } else {
      // DIRECT SIGNUP FLOW: No token required, use email-derived company name
      logInfo(MODULE, handler, 'Direct signup (no invite token)', { email });
    }

    // 2. Validate email format
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // 3. Check if user already exists
    const existingUser = await UserDB.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please sign in instead.' });
    }

    // 5. Google OAuth: Create account immediately
    if (oauth_provider === 'google') {
      let company = await CompanyDB.findCompanyByEmail(email);
      if (!company) {
        company = await CompanyDB.createCompany({
          name: companyName,
          email,
          timezone: 'UTC',
          preferredCurrency: 'USD',
        });
      }

      const user = await UserDB.createUser({
        companyId: company.id,
        email,
        passwordHash: '',
        firstName: email.split('@')[0],
        lastName: 'User',
        role: 'owner',
        authProvider: 'google',
      });

      await markTokenUsed(token, email);
      await linkTokenToCompany(token, company.id);
      setAuthCookies(res, user.id, company.id, user.email);
      await CompanyDB.updateCompany(company.id, { onboarding_stage: 'create_account' });

      logInfo(MODULE, handler, 'Google OAuth account created', { userId: user.id });

      return res.json({
        success: true,
        next_stage: 3,
        user: { id: user.id, email: user.email },
        company: { id: company.id, name: company.name },
      });
    }

    // 6. Email+PW: validate password and send OTP
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

    // Store pending data — include company_name (from invite or email domain)
    await redisClient.set(
      `stage1_pending:${email}`,
      JSON.stringify({ email, passwordHash, token: token || null, invite_company_name: companyName }),
      { EX: 15 * 60 }
    );
    await redisClient.set(`otp:${email}`, otp, { EX: 15 * 60 });

    if (!isDev) {
      try {
        await resendService.sendEmail({
          to: email,
          subject: 'Verify your email — CashOS',
          bodyText: `Your verification code: ${otp}`,
          bodyHtml: `<p>Your verification code: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p><p>Valid for 15 minutes.</p>`,
        });
      } catch (emailErr) {
        logError(MODULE, handler, 'Failed to send OTP email', emailErr);
      }
    }

    logInfo(MODULE, handler, 'OTP sent for email verification', { email, devMode: isDev });

    return res.json({
      success: true,
      requires_otp_verification: true,
      message: isDev ? 'Dev mode: OTP is 123456' : 'Verification code sent to your email',
      devOtp: isDev ? '123456' : undefined,
    });
  } catch (err) {
    logError(MODULE, handler, 'Error in Stage 1 auth', err);
    return res.status(500).json({ error: 'Failed to process auth' });
  }
};

/**
 * STAGE 2: Verify OTP & Create Account
 * Sets auth cookies, creates company + user
 * After this: user is authenticated and goes to Stage 3 (details)
 */
export const verifyStage1OTP = async (req: Request, res: Response) => {
  const { email, otp, token } = req.body;
  const handler = 'verifyStage1OTP';

  try {
    logInfo(MODULE, handler, 'OTP verification', { email });

    // 1. Verify OTP
    const storedOtp = await redisClient.get(`otp:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // 2. Get pending account data
    const pendingDataStr = await redisClient.get(`stage1_pending:${email}`);
    if (!pendingDataStr) {
      return res.status(400).json({ error: 'Session expired, please start again' });
    }
    const { passwordHash, invite_company_name } = JSON.parse(pendingDataStr);

    // 3. Create company
    let company = await CompanyDB.findCompanyByEmail(email);
    if (!company) {
      company = await CompanyDB.createCompany({
        name: invite_company_name || email.split('@')[1] || 'My Company',
        email,
        timezone: 'UTC',
        preferredCurrency: 'USD',
      });
      logInfo(MODULE, handler, 'Company created', { companyId: company.id });
    }

    // 4. Create user
    const user = await UserDB.createUser({
      companyId: company.id,
      email,
      passwordHash,
      firstName: email.split('@')[0],
      lastName: 'User',
      role: 'owner',
      authProvider: 'email',
    });

    // 5. Mark token as used and link to company (only if token provided — invite flow)
    if (token) {
      await markTokenUsed(token, email);
      await linkTokenToCompany(token, company.id);
    }

    // 6. Set auth cookies
    setAuthCookies(res, user.id, company.id, user.email);

    // 7. Update onboarding stage
    await CompanyDB.updateCompany(company.id, { onboarding_stage: 'create_account' });

    // 8. Clean Redis
    await redisClient.del(`otp:${email}`);
    await redisClient.del(`stage1_pending:${email}`);

    logInfo(MODULE, handler, 'Account created after OTP', { userId: user.id });

    return res.json({
      success: true,
      next_stage: 3,
      user: { id: user.id, email: user.email },
      company: { id: company.id, name: company.name },
    });
  } catch (err) {
    logError(MODULE, handler, 'Error verifying OTP', err);
    return res.status(500).json({ error: 'Failed to verify code' });
  }
};

/**
 * STAGE 3: Update Company Details (AUTHENTICATED)
 * User is now logged in, they confirm/update their company name
 */
export const updateStage3Details = async (req: Request, res: Response) => {
  const { company_name } = req.body;
  const handler = 'updateStage3Details';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!company_name || !company_name.toString().trim()) {
      return res.status(400).json({ error: 'Company name required' });
    }

    await CompanyDB.updateCompany(companyId, {
      name: company_name.toString().trim(),
      onboarding_stage: 'details_form',
    });

    logInfo(MODULE, handler, 'Company details updated', { companyId });

    return res.json({ success: true });
  } catch (err) {
    logError(MODULE, handler, 'Error updating details', err);
    return res.status(500).json({ error: 'Failed to update details' });
  }
};

/**
 * STAGE 4: Get integration status (Stripe + QB)
 * AUTHENTICATED
 */
export const getStage4Status = async (req: Request, res: Response) => {
  const handler = 'getStage4Status';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.onboarding_stage === 'details_form' || company.onboarding_stage === 'create_account') {
      await CompanyDB.updateCompany(companyId, { onboarding_stage: 'integrations' });
    }

    // Check CSV: has any manually imported invoices
    let csv_connected = false;
    try {
      const csvResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE company_id = $1 AND source = 'manual'`,
        [companyId]
      );
      csv_connected = parseInt(csvResult.rows[0]?.cnt || '0') > 0;
    } catch { /* non-blocking */ }

    return res.json({
      stripe_connected: !!company.stripe_account_id || !!company.stripe_api_key_encrypted,
      csv_connected,
      qb_connected: !!company.quickbooks_realm_id,
      company_name: company.name,
    });
  } catch (err) {
    logError(MODULE, handler, 'Error getting status', err);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
};

/**
 * STAGE 4: Proceed to Stage 5 (requires Stripe)
 * AUTHENTICATED
 */
export const proceedFromStage4 = async (req: Request, res: Response) => {
  const handler = 'proceedFromStage4';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for at least one integration: Stripe OR CSV (manually imported invoices)
    let csvConnected = false;
    try {
      const csvResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE company_id = $1 AND source = 'manual'`,
        [companyId]
      );
      csvConnected = parseInt(csvResult.rows[0]?.cnt || '0') > 0;
    } catch { /* non-blocking */ }

    const stripeConnected = !!company.stripe_api_key_encrypted || !!company.stripe_account_id;

    // Require at least one integration (dev mode allows either)
    if (!isDev && !stripeConnected && !csvConnected) {
      return res.status(400).json({ error: 'Connect Stripe or import invoices via CSV to proceed' });
    }

    logInfo(MODULE, handler, 'Company data before sync', {
      stripe_account_id: !!company.stripe_account_id,
      stripe_api_key_encrypted: !!company.stripe_api_key_encrypted,
      isDev,
    });

    // AUTO-SYNC: Fetch invoices from Stripe immediately after connection
    if (isDev || company.stripe_api_key_encrypted) {
      try {
        logInfo(MODULE, handler, 'Starting Stripe sync', { isDev, has_key: !!company.stripe_api_key_encrypted });

        const { decryptField } = require('../lib/encryption');
        const Stripe = require('stripe');

        const apiKey = decryptField(company.stripe_api_key_encrypted);
        logInfo(MODULE, handler, 'Key decrypted, creating Stripe client');

        const stripe = new Stripe(apiKey);

        // Fetch all invoices from Stripe (with pagination for >100 invoices)
        logInfo(MODULE, handler, 'Fetching from Stripe API...');
        const allInvoices: any[] = [];
        let hasMore = true;
        let startingAfter: string | undefined;
        while (hasMore) {
          const page = await stripe.invoices.list({ limit: 100, starting_after: startingAfter });
          allInvoices.push(...page.data);
          hasMore = page.has_more;
          if (page.data.length > 0) {
            startingAfter = page.data[page.data.length - 1].id;
          }
        }
        const invoices = { data: allInvoices };

        logInfo(MODULE, handler, 'Fetching invoices from Stripe', { count: invoices.data.length });

        // Sync each invoice to local database
        let syncedCount = 0;
        let skippedCount = 0;

        for (const stripeInv of invoices.data) {
          try {
            // Extract customer email from Stripe invoice (same as stripeService.ts)
            // Skip invoices without customer email — can't send dunning emails anyway
            if (!stripeInv.customer_email) {
              logWarn(MODULE, handler, 'Skipping invoice without customer email', {
                stripeInvoiceId: stripeInv.id,
                customerId: stripeInv.customer,
              });
              skippedCount++;
              continue;
            }

            const customerEmail = stripeInv.customer_email;
            const customerName = stripeInv.customer_name || customerEmail;

            // Create or find customer with actual email (not placeholder)
            const customerResult = await pool.query(
              `INSERT INTO customers (company_id, company_name, email)
               VALUES ($1, $2, $3)
               ON CONFLICT (company_id, company_name) DO UPDATE SET email = EXCLUDED.email
               RETURNING id`,
              [companyId, customerName, customerEmail]
            );
            const customerId = customerResult.rows[0]?.id;

            if (!customerId) {
              logError(MODULE, handler, 'Could not create customer for invoice', {
                stripeInvoiceId: stripeInv.id,
                customerEmail,
              });
              continue;
            }

            const stripeCreatedAt = new Date(stripeInv.created * 1000);
            await pool.query(
              `INSERT INTO invoices (company_id, customer_id, amount, currency, due_date, issued_date, status, source, source_id, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'stripe', $8, $9, NOW())
               ON CONFLICT (company_id, source, source_id) DO NOTHING`,
              [
                companyId,
                customerId,
                (stripeInv.amount_due || 0) / 100,
                stripeInv.currency?.toUpperCase() || 'USD',
                stripeInv.due_date ? new Date(stripeInv.due_date * 1000) : new Date(),
                stripeCreatedAt,
                stripeInv.status || 'draft',
                stripeInv.id,
                stripeCreatedAt,
              ]
            );
            syncedCount++;
          } catch (invoiceErr: any) {
            logError(MODULE, handler, 'Failed to insert invoice', {
              stripeInvoiceId: stripeInv.id,
              error: String(invoiceErr)
            });
          }
        }
        logInfo(MODULE, handler, 'Invoices synced from Stripe', {
          totalFetched: invoices.data.length,
          syncedCount,
          skippedCount,
          companyId
        });

        // Return summary for frontend toasts
        var syncSummary = { imported: syncedCount, skipped: skippedCount };
      } catch (syncErr: any) {
        logError(MODULE, handler, 'Invoice sync failed (non-blocking)', {
          error: syncErr.message,
          details: syncErr.detail || syncErr.code
        });
        // Continue anyway - user can still proceed to dashboard
        var syncSummary = { imported: 0, skipped: 0 };
      }
    } else {
      logInfo(MODULE, handler, 'Skipping sync - conditions not met', {
        isDev,
        has_account_id: !!company.stripe_account_id,
        has_key: !!company.stripe_api_key_encrypted,
      });
      var syncSummary = { imported: 0, skipped: 0 };
    }

    // ✅ CRITICAL: Pipeline complete
    // Set user.onboarding_status = 'active' (onboarding pipeline done)
    // Set company to trial_active + activate 21-day trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 21);

    const userId = (req as any).userId;

    // Update user onboarding status to 'active' (pipeline complete)
    await pool.query(
      'UPDATE users SET onboarding_status = $1, updated_at = NOW() WHERE id = $2',
      ['active', userId]
    );

    // Update company to trial_active
    await CompanyDB.updateCompany(companyId, {
      onboarding_stage: 'trial_active',
      trial_status: 'active',
      trial_starts_at: new Date(),
      trial_ends_at: trialEndsAt,
      account_type: 'pilot',
    });

    // Send dashboard welcome email (non-blocking)
    try {
      const user = await pool.query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
      if (user.rows.length > 0) {
        const { email, first_name } = user.rows[0];
        const company = await CompanyDB.findCompanyById(companyId);

        // Import here to avoid circular deps
        const resendService = (await import('../services/resendService')).default;
        await resendService.sendDashboardWelcome({
          email,
          firstName: first_name || 'there',
          companyName: company?.name || 'your company',
        });
        logInfo(MODULE, handler, 'Dashboard welcome email sent', { email, companyId });
      }
    } catch (emailErr) {
      logError(MODULE, handler, 'Failed to send dashboard welcome email (non-blocking)', emailErr);
      // Don't throw — onboarding is already complete
    }

    return res.json({ success: true, next_stage: 'dashboard', syncSummary });
  } catch (err) {
    logError(MODULE, handler, 'Error proceeding to stage 5', err);
    return res.status(500).json({ error: 'Failed to proceed' });
  }
};

/**
 * STAGE 5: Generate HONEST audit analysis from Stripe data
 * AUTHENTICATED
 *
 * Shows REAL metrics from Stripe:
 * 1. Total invoiced amount
 * 2. Unpaid invoices
 * 3. Overdue AR (past due)
 * 4. Days Sales Outstanding (DSO)
 * 5. Billing errors detected (duplicates, spikes)
 *
 * Does NOT show (requires Plaid/QB):
 * - Available cash (need bank balance)
 * - Runway (need burn rate)
 * - Payables (need QB)
 */
export const generateAuditAnalysis = async (req: Request, res: Response) => {
  const handler = 'generateAuditAnalysis';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for encrypted API key (set by /api/stripe/validate-key endpoint, not stripe_account_id)
    if (!isDev && !company.stripe_api_key_encrypted) {
      return res.status(400).json({ error: 'Stripe not connected' });
    }

    logInfo(MODULE, handler, 'Generating audit analysis from Stripe data', { companyId });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Fetch ALL invoices (paid + unpaid)
    // ═══════════════════════════════════════════════════════════════════════════

    const invoicesResult = await pool.query(
      `SELECT id, source_id, amount, currency, customer_id, status,
              created_at, due_date, issued_date, notes
       FROM invoices
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId]
    );
    const invoices = invoicesResult.rows || [];

    // If no data, return clean response
    if (!invoices || invoices.length === 0) {
      await CompanyDB.updateCompany(companyId, { onboarding_stage: 'trial_offer' });
      return res.json({
        source: 'stripe',
        total_invoiced: 0,
        total_unpaid: 0,
        overdue_ar: 0,
        avg_days_late: 0,
        oldest_unpaid_days: 0,
        billing_errors: {
          duplicates: { count: 0, estimated_value: 0 },
          spikes: { count: 0, estimated_value: 0 },
          total_at_risk: 0,
        },
        next_steps: [
          'No invoices synced yet. Send some invoices first.',
          'Once synced, we\'ll identify billing errors and at-risk customers.',
        ],
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: DETECT BILLING ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    // === DUPLICATES: Exact same customer + amount + created same day ===
    // Group by (customer, amount, created_date) to find duplicate invoice GROUPS
    const duplicateGroups = new Map<string, any[]>();
    invoices.forEach((inv: any) => {
      const createdDate = new Date(inv.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
      const key = `${inv.customer_id}|${Math.round(parseFloat(inv.amount))}|${createdDate}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(inv);
    });

    // Count actual duplicate invoices (not pairs)
    const duplicates: any[] = [];
    duplicateGroups.forEach((group) => {
      if (group.length >= 2) {
        // This group has duplicates
        group.forEach((inv: any) => {
          duplicates.push({
            invoice_id: inv.id,
            customer_id: inv.customer_id,
            amount: parseFloat(inv.amount),
            created_date: new Date(inv.created_at).toLocaleDateString('en-CA'),
            group_size: group.length, // How many invoices in this duplicate group
          });
        });
      }
    });

    // === SPIKES: Revenue 2.5x+ above customer average (validated on real data) ===
    const customerAvgs = new Map<string, { total: number; count: number }>();
    invoices.forEach((inv: any) => {
      const cid = inv.customer_id;
      if (!customerAvgs.has(cid)) {
        customerAvgs.set(cid, { total: 0, count: 0 });
      }
      const data = customerAvgs.get(cid)!;
      data.total += parseFloat(inv.amount);
      data.count += 1;
    });

    const spikes: any[] = [];
    invoices.forEach((inv: any) => {
      const data = customerAvgs.get(inv.customer_id)!;
      const avg = data.total / data.count;
      const multiplier = parseFloat(inv.amount) / avg;
      if (multiplier > 2.5) { // 2.5x threshold (more conservative, validated on 50K dataset)
        const pct = (multiplier - 1) * 100;
        spikes.push({
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          amount: parseFloat(inv.amount),
          spike_percentage: Math.round(pct),
        });
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Calculate REAL metrics from Stripe data
    // ═══════════════════════════════════════════════════════════════════════════
    const now = new Date();
    let totalInvoiced = 0;
    let totalUnpaid = 0;
    let overdueAmount = 0;
    const daysLateArray: number[] = [];
    let oldestUnpaidDays = 0;
    const unpaidInvoices: any[] = [];

    invoices.forEach((inv: any) => {
      const amount = parseFloat(inv.amount);
      totalInvoiced += amount;

      if (inv.status !== 'paid') {
        totalUnpaid += amount;
        const dueDate = new Date(inv.due_date || inv.created_at);
        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLate > 0) {
          overdueAmount += amount;
          daysLateArray.push(daysLate);
          oldestUnpaidDays = Math.max(oldestUnpaidDays, daysLate);
        }
        unpaidInvoices.push({ ...inv, daysLate });
      }
    });

    const avgDaysLate = daysLateArray.length > 0
      ? Math.round(daysLateArray.reduce((a, b) => a + b) / daysLateArray.length)
      : 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3.5: Extract ADDITIONAL METRICS (discovered from 50K dataset analysis)
    // ═══════════════════════════════════════════════════════════════════════════

    // Metric 1: AGING BUCKET ANALYSIS (0-30, 31-60, 61-90, 90+)
    const agingBuckets = {
      bucket_0_30: { count: 0, amount: 0 },
      bucket_31_60: { count: 0, amount: 0 },
      bucket_61_90: { count: 0, amount: 0 },
      bucket_90plus: { count: 0, amount: 0 },
    };

    unpaidInvoices.forEach((inv: any) => {
      const amount = parseFloat(inv.amount);
      if (inv.daysLate <= 30) {
        agingBuckets.bucket_0_30.count += 1;
        agingBuckets.bucket_0_30.amount += amount;
      } else if (inv.daysLate <= 60) {
        agingBuckets.bucket_31_60.count += 1;
        agingBuckets.bucket_31_60.amount += amount;
      } else if (inv.daysLate <= 90) {
        agingBuckets.bucket_61_90.count += 1;
        agingBuckets.bucket_61_90.amount += amount;
      } else {
        agingBuckets.bucket_90plus.count += 1;
        agingBuckets.bucket_90plus.amount += amount;
      }
    });

    // Metric 2: CUSTOMER CONCENTRATION (80/20 Rule) - Which customers hold the most risk
    const customerUnpaid = new Map<string, number>();
    unpaidInvoices.forEach((inv: any) => {
      const amount = parseFloat(inv.amount);
      customerUnpaid.set(inv.customer_id, (customerUnpaid.get(inv.customer_id) || 0) + amount);
    });

    const sortedCustomers = Array.from(customerUnpaid.entries())
      .sort((a, b) => b[1] - a[1]);

    let cumulativeAmount = 0;
    let customersFor80Percent = 0;
    for (const [_, amount] of sortedCustomers) {
      cumulativeAmount += amount;
      customersFor80Percent += 1;
      if (cumulativeAmount >= 0.8 * totalUnpaid) {
        break;
      }
    }

    const concentrationRatio = customerUnpaid.size > 0
      ? (100 * customersFor80Percent / customerUnpaid.size)
      : 0;

    // Metric 3: HIGH-RISK INVOICES (30+ days late AND >= $50K) - Phone call candidates
    const highRiskInvoices = unpaidInvoices.filter((inv: any) => {
      return inv.daysLate >= 30 && parseFloat(inv.amount) >= 50000;
    });
    const highRiskTotal = highRiskInvoices.reduce((sum: number, inv: any) => {
      return sum + parseFloat(inv.amount);
    }, 0);

    // Metric 4: MONTHLY TREND ANALYSIS (Is unpaid AR improving or worsening?)
    const monthlyUnpaid = new Map<string, number>();
    unpaidInvoices.forEach((inv: any) => {
      const createdDate = new Date(inv.created_at);
      const month = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyUnpaid.set(month, (monthlyUnpaid.get(month) || 0) + parseFloat(inv.amount));
    });

    const sortedMonths = Array.from(monthlyUnpaid.keys()).sort();
    let trendDirection = 'stable';
    let trendPercentChange = 0;

    if (sortedMonths.length >= 2) {
      const firstMonth = monthlyUnpaid.get(sortedMonths[0]) || 0;
      const lastMonth = monthlyUnpaid.get(sortedMonths[sortedMonths.length - 1]) || 0;
      if (firstMonth > 0) {
        trendPercentChange = ((lastMonth - firstMonth) / firstMonth) * 100;
        trendDirection = lastMonth < firstMonth ? 'improving' : 'worsening';
      }
    }

    // Calculate billing error exposure (REAL - from detected duplicates and spikes only)
    // For duplicates: we count ACTUAL invoice count (not pairs)
    const uniqueDuplicateInvoiceCount = duplicates.length;
    const duplicateValue = duplicates.reduce((sum, d) => sum + d.amount, 0);

    const spikeValue = spikes.reduce((sum, s) => sum + (s.amount * s.spike_percentage / 100), 0);
    const totalBillingErrorsAtRisk = duplicateValue + spikeValue;

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Build next steps message
    // ═══════════════════════════════════════════════════════════════════════════
    const nextSteps: string[] = [];
    if (overdueAmount > 0) {
      nextSteps.push(`You have $${Math.round(overdueAmount)} in overdue AR averaging ${avgDaysLate} days late.`);
    }
    if (duplicates.length > 0) {
      nextSteps.push(`Found ${duplicates.length} duplicate invoices. We can flag these in your dashboard.`);
    }
    if (spikes.length > 0) {
      nextSteps.push(`Detected ${spikes.length} anomalies in billing. Review these to ensure accuracy.`);
    }
    nextSteps.push(`Next: Connect your bank (Plaid) to see cash runway and full forecast.`);

    await CompanyDB.updateCompany(companyId, { onboarding_stage: 'trial_offer' });

    logInfo(MODULE, handler, 'Audit analysis generated (Stripe data + advanced metrics)', {
      companyId,
      totalInvoiced,
      totalUnpaid,
      overdueAr: overdueAmount,
      duplicateInvoices: uniqueDuplicateInvoiceCount,
      spikeInvoices: spikes.length,
      avgDaysLate,
      highRiskInvoices: highRiskInvoices.length,
      customersFor80: customersFor80Percent,
      trend: trendDirection,
    });

    return res.json({
      // Metadata
      source: 'stripe',
      generated_at: new Date().toISOString(),

      // REAL metrics from Stripe
      total_invoiced: Math.round(totalInvoiced),
      total_unpaid: Math.round(totalUnpaid),
      overdue_ar: Math.round(overdueAmount),
      avg_days_late: avgDaysLate,
      oldest_unpaid_days: oldestUnpaidDays,

      // AGING BUCKET ANALYSIS (0-30, 31-60, 61-90, 90+ days)
      aging_buckets: {
        bucket_0_30: {
          count: agingBuckets.bucket_0_30.count,
          amount: Math.round(agingBuckets.bucket_0_30.amount),
          percentage: totalUnpaid > 0 ? Math.round(100 * agingBuckets.bucket_0_30.amount / totalUnpaid) : 0,
        },
        bucket_31_60: {
          count: agingBuckets.bucket_31_60.count,
          amount: Math.round(agingBuckets.bucket_31_60.amount),
          percentage: totalUnpaid > 0 ? Math.round(100 * agingBuckets.bucket_31_60.amount / totalUnpaid) : 0,
        },
        bucket_61_90: {
          count: agingBuckets.bucket_61_90.count,
          amount: Math.round(agingBuckets.bucket_61_90.amount),
          percentage: totalUnpaid > 0 ? Math.round(100 * agingBuckets.bucket_61_90.amount / totalUnpaid) : 0,
        },
        bucket_90plus: {
          count: agingBuckets.bucket_90plus.count,
          amount: Math.round(agingBuckets.bucket_90plus.amount),
          percentage: totalUnpaid > 0 ? Math.round(100 * agingBuckets.bucket_90plus.amount / totalUnpaid) : 0,
        },
      },

      // CUSTOMER CONCENTRATION (80/20 Rule - which customers hold the risk)
      customer_concentration: {
        total_unique_customers: customerUnpaid.size,
        customers_holding_80_percent: customersFor80Percent,
        concentration_ratio_percentage: Math.round(concentrationRatio * 10) / 10, // 1 decimal
        note: `Top ${customersFor80Percent} customers hold 80% of your unpaid AR`,
      },

      // HIGH-RISK INVOICES (30+ days AND $50K+) - Candidates for phone calls
      high_risk_invoices: {
        count: highRiskInvoices.length,
        total_amount: Math.round(highRiskTotal),
        percentage_of_unpaid: totalUnpaid > 0 ? Math.round(100 * highRiskTotal / totalUnpaid) : 0,
        note: `${highRiskInvoices.length} invoices ready for phone call collection`,
      },

      // TREND ANALYSIS (Is unpaid AR improving or worsening?)
      trend: {
        direction: trendDirection, // 'improving', 'worsening', or 'stable'
        percent_change: Math.round(trendPercentChange * 10) / 10, // 1 decimal
        months_tracked: sortedMonths.length,
        note: trendDirection === 'improving'
          ? 'Good news: your unpaid AR is decreasing'
          : trendDirection === 'worsening'
          ? 'Alert: your unpaid AR is growing'
          : 'Your unpaid AR is stable',
      },

      // Billing errors (REAL detections)
      billing_errors: {
        duplicates: {
          count: uniqueDuplicateInvoiceCount,
          estimated_value: Math.round(duplicateValue),
        },
        spikes: {
          count: spikes.length,
          estimated_value: Math.round(spikeValue),
        },
        total_at_risk: Math.round(totalBillingErrorsAtRisk),
      },

      // What's coming next
      next_steps: nextSteps,

      // Message about Plaid
      plaid_unlocks: {
        cash_balance: 'Real bank account balance (not estimated)',
        cash_runway: 'Days until you run out of cash',
        burn_rate: 'Actual monthly spending',
        payables: 'Bills you owe (from QuickBooks)',
      },
    });
  } catch (err) {
    logError(MODULE, handler, 'Error generating analysis', err);
    return res.status(500).json({ error: 'Failed to generate analysis' });
  }
};

/**
 * STAGE 5: Start trial
 * AUTHENTICATED
 */
export const startTrial = async (req: Request, res: Response) => {
  const handler = 'startTrial';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await CompanyDB.updateCompany(companyId, {
      onboarding_stage: 'trial_active',
      trial_status: 'active',
      trial_starts_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    logInfo(MODULE, handler, 'Trial started', { companyId });

    return res.json({ success: true, message: 'Trial started', company: { id: company.id, name: company.name } });
  } catch (err) {
    logError(MODULE, handler, 'Error starting trial', err);
    return res.status(500).json({ error: 'Failed to start trial' });
  }
};

/**
 * Check current onboarding stage (for resume after kill app)
 * AUTHENTICATED — returns which frontend stage to redirect to
 */
export const checkOnboardingStage = async (req: Request, res: Response) => {
  const handler = 'checkOnboardingStage';

  try {
    const companyId = (req as any).companyId;
    const userId = (req as any).userId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get user to check admin role
    const user = await UserDB.findUserById(userId);
    const isAdmin = user?.role === 'admin' || user?.role === 'owner';

    // Map DB stage → frontend stage number
    const stageMap: Record<string, number> = {
      create_account: 3,   // Account created → go to details
      details_form: 4,     // Details done → go to integrations
      integrations: 4,     // Still in integrations
      audit_report: 5,     // Analysis ready
      trial_offer: 5,      // Trial page
      trial_active: 0,     // Done → dashboard
      paid_active: isAdmin ? 0 : 3,  // Admin→dashboard, normal users→onboarding stage 3
    };

    const stageNumber = stageMap[company.onboarding_stage || ''] ?? 3;

    return res.json({
      stage: stageNumber,
      onboarding_stage: company.onboarding_stage,
      company_name: company.name,
    });
  } catch (err) {
    logError(MODULE, handler, 'Error checking stage', err);
    return res.status(500).json({ error: 'Failed to check stage' });
  }
};

/**
 * Validate token (for initial link entry, no auth required)
 */
export const validateToken = async (req: Request, res: Response) => {
  const { token } = req.query;
  const handler = 'validateToken';

  try {
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }

    const invite = await getInviteToken(token);
    if (!invite) {
      // Check why it failed — was it used or just not found?
      const raw = await pool.query(
        `SELECT used_at, expires_at FROM invite_tokens WHERE token = $1`,
        [token]
      );
      if (raw.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid link — not found' });
      }
      if (raw.rows[0].used_at) {
        return res.status(410).json({ error: 'This link has already been used. If you created an account, please sign in.' });
      }
      if (new Date(raw.rows[0].expires_at) < new Date()) {
        return res.status(410).json({ error: 'This link has expired. Ask your contact for a new one.' });
      }
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    const expiresAt = new Date(invite.expires_at);
    const now = new Date();
    const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return res.json({
      valid: true,
      expires_in_days: daysLeft,
      pre_filled_email: invite.email || null,
      company_name: invite.company_name,
    });
  } catch (err) {
    logError(MODULE, handler, 'Error validating token', err);
    return res.status(500).json({ error: 'Failed to validate link' });
  }
};
