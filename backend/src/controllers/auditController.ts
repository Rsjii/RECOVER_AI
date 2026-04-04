// @ts-nocheck — OLD flow, not mounted in app.ts, kept for reference only
import { Request, Response } from 'express';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logInfo, logError } from '../utils/logger';
import { config } from '../config/env';
import { pool } from '../config/database';
import resendService from '../services/resendService';
import { stripeService } from '../services/stripeService';
import { redisClient } from '../config/redis';
import * as CompanyDB from '../db/companies';
import * as UserDB from '../db/users';
import * as AuditDB from '../db/audits';
import * as AuditInvitesDB from '../db/auditInvites';
import * as AuditRequestsDB from '../db/auditRequests';
import { runDecisionEngineNow } from '../queue/agentLoop';

const MODULE = 'auditController';

/**
 * STEP 0 (NEW): Create audit account early
 * Called as soon as user enters email in FreeAuditSignup
 * Creates account + company, sets onboarding_status='company_form'
 * Enables session persistence & resumption if user kills app
 *
 * POST /api/audits/create-account { email, inviteToken? }
 * Returns: { user: { id, email }, company: { id, name }, accessToken (in cookie) }
 */
export const createAuditAccount = async (req: Request, res: Response) => {
  const { email, inviteToken } = req.body;
  const handler = 'createAuditAccount';

  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    logInfo(MODULE, handler, 'Audit account creation request', { email, hasInvite: !!inviteToken });

    // Check if account already exists
    const existing = await UserDB.findUserWithCompanyByEmail(email);
    if (existing) {
      logInfo(MODULE, handler, 'Account already exists for email', { email, userId: existing.id });

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: existing.id, companyId: existing.company_id, email: existing.email },
        config.jwtSecret || 'your-secret-key',
        { expiresIn: '30d' }
      );

      // Set cookie
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as any,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return res.json({
        user: { id: existing.id, email: existing.email, onboardingStatus: existing.onboarding_status },
        company: { id: existing.company_id, name: existing.company_name },
      });
    }

    // Create company (use domain as company name)
    const domain = email.split('@')[1];
    const company = await CompanyDB.createCompany({
      name: domain,
      email: email,
      timezone: 'UTC',
      preferredCurrency: 'USD',
    });

    logInfo(MODULE, handler, 'Company created', { companyId: company.id, domain });

    // Create user with temporary password + onboarding_status='company_form'
    const tempPassword = Math.random().toString(36).substring(7);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await UserDB.createUser({
      companyId: company.id,
      email,
      passwordHash,
      firstName: 'Founder',
      lastName: email.split('@')[0],
      role: 'owner',
    });

    logInfo(MODULE, handler, 'User created', { userId: user.id });

    // Update onboarding status to 'company_form'
    await UserDB.updateOnboardingStatus(user.id, 'company_form');

    // Set company owner
    await CompanyDB.setCompanyOwner(company.id, user.id);

    // Generate access token (30 day expiry for account persistence)
    const accessToken = jwt.sign(
      { userId: user.id, companyId: company.id, email: user.email },
      config.jwtSecret || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Set httpOnly cookie (auth middleware reads from cookies)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as any,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    logInfo(MODULE, handler, 'Account created successfully', { userId: user.id, companyId: company.id });

    return res.json({
      user: { id: user.id, email: user.email, onboardingStatus: 'company_form' },
      company: { id: company.id, name: company.name },
    });
  } catch (err: any) {
    logInfo(MODULE, handler, 'Error', { error: err.message });
    return res.status(400).json({ error: err.message || 'Failed to create account' });
  }
};

/**
 * STEP 1: Handle Stripe OAuth callback
 * Prospect approves → we get access token → trigger analysis
 */
export const handleStripeOAuthCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const auditId = state as string;

  try {
    logInfo(MODULE, 'handleStripeOAuthCallback', 'OAuth callback received', { auditId });

    // 0. Get audit to access email for user lookup
    const audit = await AuditDB.getAuditRequest(auditId);
    if (!audit) {
      throw new Error('Audit not found');
    }

    // 1. Exchange code for access token
    const tokenResult = await stripeService.getAccessToken(code as string);

    if (tokenResult.error) {
      throw new Error(tokenResult.error);
    }

    // 2. Store in audit_requests table
    await AuditDB.updateAuditRequest(auditId, {
      stripe_account_id: tokenResult.stripe_user_id,
      stripe_access_token: tokenResult.access_token,
      status: 'stripe_connected',
    });

    logInfo(MODULE, 'handleStripeOAuthCallback', 'OAuth stored', { auditId });

    // 2b. Update to analysis_in_progress status
    try {
      await AuditRequestsDB.updateAuditStatus({
        id: auditId,
        status: 'analysis_in_progress',
        analysisStartedAt: true,
      });
    } catch (err: any) {
      logInfo(MODULE, 'handleStripeOAuthCallback', 'Failed to update analysis status (non-blocking)', { error: err.message });
    }

    // 2c. Update user's onboarding_status to 'active' (Stripe connected = account fully set up)
    try {
      const user = await UserDB.findUserByEmail(audit.email);
      if (user) {
        await UserDB.updateOnboardingStatus(user.id, 'active');
        logInfo(MODULE, 'handleStripeOAuthCallback', 'Updated onboarding_status to active', { userId: user.id });
      }
    } catch (err: any) {
      logInfo(MODULE, 'handleStripeOAuthCallback', 'Failed to update onboarding_status (non-blocking)', { error: err.message });
    }

    // 3. Trigger analysis (await so results are ready when user lands on results page)
    try {
      await analyzeAuditAsync(auditId);
    } catch (err: any) {
      logInfo(MODULE, 'analyzeAuditAsync', 'Analysis failed', { error: err.message });
      await AuditDB.updateAuditRequest(auditId, { status: 'analysis_failed' });
      await AuditRequestsDB.updateAuditStatus({
        id: auditId,
        status: 'analysis_failed',
      }).catch(() => {});
    }

    // 4. Redirect to audit results page (analysis is complete)
    return res.redirect(`${process.env.FRONTEND_URL}/audit-results/${auditId}`);
    
  } catch (err: any) {
    logInfo(MODULE, 'handleStripeOAuthCallback', 'Error', { error: err.message });
    return res.status(400).json({ error: 'OAuth failed' });
  }
};

/**
 * STEP 3: Run the actual audit analysis (async, 48h process)
 */
const analyzeAuditAsync = async (auditId: string) => {
  try {
    logInfo(MODULE, 'analyzeAuditAsync', 'Starting analysis', { auditId });

    // Get audit record
    const audit = await AuditDB.getAuditRequest(auditId);
    if (!audit || !audit.stripe_access_token) {
      throw new Error('Audit not found or not connected to Stripe');
    }
    const stripe = new Stripe(audit.stripe_access_token);
    
    // ─────────────────────────────────────────────────────────
    // 1. AR RECOVERY ANALYSIS
    // ─────────────────────────────────────────────────────────
    logInfo(MODULE, 'analyzeAuditAsync', 'Fetching invoices');

    // Fetch only open (unpaid/overdue) invoices for accurate AR analysis
    // With pagination support for >100 invoices
    const openInvoices: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;
    while (hasMore) {
      const page = await stripe.invoices.list({ limit: 100, status: 'open', starting_after: startingAfter });
      openInvoices.push(...page.data);
      hasMore = page.has_more;
      if (page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      }
    }

    const charges: any = { data: [] };
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
      const page = await stripe.charges.list({ limit: 100, starting_after: startingAfter });
      charges.data.push(...page.data);
      hasMore = page.has_more;
      if (page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      }
    }

    const now = Date.now() / 1000;
    const analyzed = openInvoices.map(inv => {
      // Use due_date if available (most accurate), else fall back to created date
      const refDate = inv.due_date || inv.created;
      const daysOverdue = Math.max(0, Math.floor((now - refDate) / 86400));
      return {
        id: inv.id,
        customer_name: (inv.customer_name as string) || (typeof inv.customer === 'string' ? inv.customer : 'Unknown Customer'),
        customer_email: inv.customer_email,
        amount: inv.total / 100, // Stripe amounts in cents
        created: inv.created,
        due_date: inv.due_date,
        daysOverdue,
        status: inv.status,
        decline_code: (charges.data.find((c: any) => c.invoice === inv.id) as any)
          ?.outcome?.network_status === 'declined_by_network'
          ? ((charges.data.find((c: any) => c.invoice === inv.id) as any)?.failure_code || 'declined')
          : null,
      };
    });

    // Segment by days overdue (only open invoices — already filtered above)
    const segments = {
      stage1: analyzed.filter(i => i.daysOverdue >= 30 && i.daysOverdue < 60),
      stage2: analyzed.filter(i => i.daysOverdue >= 60 && i.daysOverdue < 90),
      stage3: analyzed.filter(i => i.daysOverdue >= 90 && i.daysOverdue < 120),
      stage4: analyzed.filter(i => i.daysOverdue >= 120),
    };

    const totalOverdue = analyzed.reduce((sum, inv) => sum + inv.amount, 0);
    
    const arAnalysis = {
      total_invoices: analyzed.length,
      total_overdue: Math.round(totalOverdue),
      by_stage: {
        stage1: {
          count: segments.stage1.length,
          amount: Math.round(segments.stage1.reduce((s, i) => s + i.amount, 0)),
          recovery_rate: 0.60,
        },
        stage2: {
          count: segments.stage2.length,
          amount: Math.round(segments.stage2.reduce((s, i) => s + i.amount, 0)),
          recovery_rate: 0.35,
        },
        stage3: {
          count: segments.stage3.length,
          amount: Math.round(segments.stage3.reduce((s, i) => s + i.amount, 0)),
          recovery_rate: 0.20,
        },
        stage4: {
          count: segments.stage4.length,
          amount: Math.round(segments.stage4.reduce((s, i) => s + i.amount, 0)),
          recovery_rate: 0.08,
        },
      },
      decline_intelligence: analyzeDeclineIntelligence(analyzed, charges.data as any),
      current_recovery: 0.15,
      projected_recovery: 0.40,
      delta: Math.round(
        (0.40 - 0.15) * totalOverdue
      ),
      previews: analyzed
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    };
    
    logInfo(MODULE, 'analyzeAuditAsync', 'AR analysis complete', {
      totalOverdue: arAnalysis.total_overdue,
      delta: arAnalysis.delta,
    });
    
    // ─────────────────────────────────────────────────────────
    // 2. DSO ANALYSIS
    // ─────────────────────────────────────────────────────────
    logInfo(MODULE, 'analyzeAuditAsync', 'Calculating DSO');
    
    const paidInvoices = analyzed.filter(i => i.status === 'paid');
    const avgDaysToPay = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, i) => sum + i.daysOverdue, 0) / 
        paidInvoices.length
      : 0;
    
    const dsoAnalysis = {
      current_dso: Math.round(avgDaysToPay),
      benchmark_dso: 38, // SaaS industry benchmark
      gap: Math.round(avgDaysToPay - 38),
      cost_per_day: Math.round((totalOverdue / 30) * (totalOverdue / 12 / 365)),
      annual_cost: Math.round((avgDaysToPay - 38) * (totalOverdue / 12)),
      projected_dso: Math.round(avgDaysToPay - 4),
      working_capital_freed: Math.round(4 * (totalOverdue / 12 / 30)),
    };
    
    logInfo(MODULE, 'analyzeAuditAsync', 'DSO analysis complete', {
      currentDso: dsoAnalysis.current_dso,
      gap: dsoAnalysis.gap,
    });
    
    // ─────────────────────────────────────────────────────────
    // 3. CASH FLOW FORECAST (90-day)
    // ─────────────────────────────────────────────────────────
    logInfo(MODULE, 'analyzeAuditAsync', 'Generating cash forecast');
    
    // Dummy forecast (will need QB integration later)
    const cashForecast = generateBasicForecast(
      totalOverdue,
      arAnalysis.projected_recovery
    );
    
    // ─────────────────────────────────────────────────────────
    // 4. BILLING ANOMALIES
    // ─────────────────────────────────────────────────────────
    logInfo(MODULE, 'analyzeAuditAsync', 'Detecting anomalies');
    
    const anomalies = detectAnomalies(invoices.data);
    
    const anomalyImpact = {
      duplicates: anomalies.filter(a => a.type === 'duplicate').length,
      duplicate_savings: anomalies
        .filter(a => a.type === 'duplicate')
        .reduce((sum, a) => sum + a.amount, 0),
      amount_spikes: anomalies.filter(a => a.type === 'amount_spike').length,
      fraud_patterns: anomalies.filter(a => a.type === 'fraud_pattern').length,
    };
    
    logInfo(MODULE, 'analyzeAuditAsync', 'Anomalies detected', {
      duplicates: anomalyImpact.duplicates,
      savings: anomalyImpact.duplicate_savings,
    });
    
    // ─────────────────────────────────────────────────────────
    // 5. TOTAL OPPORTUNITY
    // ─────────────────────────────────────────────────────────
    const totalOpportunity = {
      ar_recovery: arAnalysis.delta,
      dso_reduction: dsoAnalysis.working_capital_freed,
      anomaly_savings: anomalyImpact.duplicate_savings,
      total: arAnalysis.delta + dsoAnalysis.working_capital_freed + 
             anomalyImpact.duplicate_savings,
      monthly_cost: 2500,
      monthly_recovery_fee: Math.round(arAnalysis.delta * 0.01 / 3),
      roi: 0,
    };
    totalOpportunity.roi = Math.round(
      (totalOpportunity.total - totalOpportunity.monthly_cost) / 
      totalOpportunity.monthly_cost
    );
    
    logInfo(MODULE, 'analyzeAuditAsync', 'Total opportunity calculated', {
      total: totalOpportunity.total,
      roi: totalOpportunity.roi,
    });
    
    // ─────────────────────────────────────────────────────────
    // 6. STORE ANALYSIS RESULTS
    // ─────────────────────────────────────────────────────────

    // Calculate Cash Clarity Score (0-100)
    let cashClarityScore = 100;

    // Deduct points for billing errors
    if (anomalyImpact.duplicates > 0) cashClarityScore -= Math.min(15, anomalyImpact.duplicates * 2);
    if (anomalyImpact.amount_spikes > 0) cashClarityScore -= Math.min(10, anomalyImpact.amount_spikes);
    if (anomalyImpact.fraud_patterns > 0) cashClarityScore -= Math.min(20, anomalyImpact.fraud_patterns * 5);

    // Deduct points for overdue AR
    if (arAnalysis.total_overdue > 100000) cashClarityScore -= 15;
    else if (arAnalysis.total_overdue > 50000) cashClarityScore -= 10;
    else if (arAnalysis.total_overdue > 10000) cashClarityScore -= 5;

    // Deduct points for low runway
    const runwayDays = dsoAnalysis.runway_days || 45;
    if (runwayDays < 30) cashClarityScore -= 20;
    else if (runwayDays < 45) cashClarityScore -= 10;

    cashClarityScore = Math.max(0, Math.min(100, cashClarityScore));

    // Build risks array
    const risks: any[] = [];
    if (arAnalysis.total_overdue > arAnalysis.total_amount * 0.3) {
      risks.push({
        title: 'High Overdue AR',
        description: `${Math.round(arAnalysis.total_overdue / 1000)}K overdue (${Math.round(dsoAnalysis.avg_days_late)}d average)`,
        severity: 'high'
      });
    }
    if (runwayDays < 45) {
      risks.push({
        title: 'Low Cash Runway',
        description: `Only ${runwayDays} days of cash remaining`,
        severity: 'critical'
      });
    }
    if (anomalyImpact.fraud_patterns > 0) {
      risks.push({
        title: 'Payment Failure Cluster',
        description: `${anomalyImpact.fraud_patterns} failed payment clusters detected`,
        severity: 'high'
      });
    }

    // Build insights array
    const insights: any[] = [];
    if (anomalyImpact.duplicate_savings > 0) {
      insights.push(`Fix ${anomalyImpact.duplicates} duplicate invoices to recover $${Math.round(anomalyImpact.duplicate_savings / 1000)}K`);
    }
    if (runwayDays < 60) {
      insights.push(`Accelerate collections to improve runway from ${runwayDays} to 90+ days`);
    }
    if (arAnalysis.total_overdue > 0) {
      insights.push(`Your AR aging: ${arAnalysis.by_stage.stage1.count} invoices 30-60d, ${arAnalysis.by_stage.stage2.count} invoices 60-90d`);
    }

    // Build billing errors breakdown
    const billingErrors = {
      duplicates: {
        count: anomalyImpact.duplicates,
        value: Math.round(anomalyImpact.duplicate_savings)
      },
      spikes: {
        count: anomalyImpact.amount_spikes,
        value: 0 // Not calculated in current anomaly impact
      },
      gaps: {
        count: 0, // Not in current anomaly impact
        value: 0
      },
      failed_clusters: {
        count: anomalyImpact.fraud_patterns,
        value: 0
      },
      total_value: Math.round(anomalyImpact.duplicate_savings)
    };

    // Build analysis_data object for storage
    const analysisData = {
      cash_clarity_score: cashClarityScore,
      available_cash: Math.round(arAnalysis.total_overdue),
      runway_days: Math.round(runwayDays),
      overdue_ar: Math.round(arAnalysis.total_overdue),
      avg_days_late: Math.round(dsoAnalysis.avg_days_late || 0),
      billing_errors: billingErrors,
      risks,
      insights,
      // Raw data for advanced analysis
      ar_analysis: arAnalysis,
      dso_analysis: dsoAnalysis,
      forecast: cashForecast,
      total_opportunity: totalOpportunity
    };

    await AuditDB.updateAuditRequest(auditId, {
      status: 'analysis_complete',
      analysis_data: analysisData,
    });

    logInfo(MODULE, 'analyzeAuditAsync', 'Analysis stored', {
      auditId,
      cashClarityScore,
      billingErrorsValue: billingErrors.total_value
    });
    
    // ─────────────────────────────────────────────────────────
    // 7. SEND EMAIL WITH RESULTS
    // ─────────────────────────────────────────────────────────
    await sendAuditResultsEmail(
      audit.email,
      auditId,
      arAnalysis,
      dsoAnalysis,
      totalOpportunity
    );
    
    logInfo(MODULE, 'analyzeAuditAsync', 'Email sent', { email: audit.email });
    
  } catch (err: any) {
    logInfo(MODULE, 'analyzeAuditAsync', 'Error', { error: err.message });
    throw err;
  }
};

/**
 * STEP 4: Retrieve audit results (prospect views on screen)
 */
export const getAuditResults = async (req: Request, res: Response) => {
  const auditId = typeof req.params.auditId === 'string' ? req.params.auditId : String(req.params.auditId);

  try {
    const audit = await AuditDB.getAuditRequest(auditId);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    logInfo(MODULE, 'getAuditResults', 'Returning results', { auditId });

    return res.json({
      status: audit.status,
      email: audit.email,
      analysis: audit.analysis ? JSON.parse(audit.analysis as any) : null,
      completed_at: audit.completed_at,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * STEP 5: Convert audit → pilot account
 * Account already created early (createAuditAccount) → this just updates company + Stripe details
 * and kicks off async Stripe sync + dunning engine
 */
export const convertAuditToPilot = async (req: Request, res: Response) => {
  const audit_id = typeof req.body.audit_id === 'string' ? req.body.audit_id : String(req.body.audit_id);
  const inviteToken = req.body.invite_token as string | undefined;

  try {
    logInfo(MODULE, 'convertAuditToPilot', 'Starting pilot conversion (account already exists)', { audit_id, hasInvite: !!inviteToken });

    // 1. Get audit
    const audit = await AuditDB.getAuditRequest(audit_id);
    if (!audit || audit.status !== 'complete') {
      return res.status(400).json({ error: 'Audit not ready' });
    }

    // 2. Find existing user + company (created during createAuditAccount)
    const user = await UserDB.findUserWithCompanyByEmail(audit.email);
    if (!user) {
      return res.status(400).json({ error: 'Account not found. Please start with email signup.' });
    }

    logInfo(MODULE, 'convertAuditToPilot', 'Found existing account', {
      userId: user.id,
      companyId: user.company_id,
    });

    // 3. Update company with Stripe + pilot details
    await CompanyDB.updateCompany(user.company_id, {
      stripe_account_id: audit.stripe_account_id,
      stripe_api_key_encrypted: audit.stripe_access_token, // Note: should be encrypted in production
      account_type: 'pilot',
      pilot_mode: 'shadow',  // Start in shadow mode for review
      pilot_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      cash_balance_usd: 0,
    });

    logInfo(MODULE, 'convertAuditToPilot', 'Company updated with Stripe + pilot details', {
      companyId: user.company_id,
    });

    // 4. Mark audit request as converted
    try {
      await AuditRequestsDB.updateAuditStatus({
        id: audit_id,
        status: 'pilot_converted',
        userId: user.id,
      });
      await AuditRequestsDB.markAuditRequestAsConverted(audit.email);
    } catch (err: any) {
      logInfo(MODULE, 'convertAuditToPilot', 'Could not mark request as converted', { error: err.message });
    }

    // 5. Mark invite as used (prevents reuse)
    if (inviteToken) {
      try {
        await AuditInvitesDB.markAuditInviteAsUsed(inviteToken);
        logInfo(MODULE, 'convertAuditToPilot', 'Invite marked as used');
      } catch (err: any) {
        logInfo(MODULE, 'convertAuditToPilot', 'Could not mark invite as used', { error: err.message });
      }
    }

    // 6. Non-blocking: immediately sync Stripe invoices + run dunning engine
    //    So the pilot user sees their data and email queue within minutes (not 6 hours)
    setImmediate(async () => {
      try {
        logInfo(MODULE, 'convertAuditToPilot', 'Starting immediate Stripe sync for new pilot', { companyId: user.company_id });
        await stripeService.syncInvoices(user.company_id);
        logInfo(MODULE, 'convertAuditToPilot', 'Stripe sync complete — running dunning engine', { companyId: user.company_id });
        await runDecisionEngineNow();
        logInfo(MODULE, 'convertAuditToPilot', 'Initial dunning pass complete — pilot queue populated', { companyId: user.company_id });
      } catch (err: any) {
        logError(MODULE, 'convertAuditToPilot', 'Initial sync failed (non-blocking, pilot still created)', err);
      }
    });

    // Access token already exists in cookie from createAuditAccount
    // No need to set it again, just return user + company data
    return res.json({
      user: { id: user.id, email: user.email, onboardingStatus: 'active' },
      company: {
        id: user.company_id,
        name: user.company_name,
      },
    });

  } catch (err: any) {
    logInfo(MODULE, 'convertAuditToPilot', 'Error', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────

// Decline code → recommended action mapping
const DECLINE_ACTION_MAP: Record<string, { label: string; action: string; urgency: 'high' | 'medium' | 'low' }> = {
  insufficient_funds:      { label: 'Insufficient Funds', action: 'Offer 3–6 month payment plan — they want to pay but can\'t right now', urgency: 'high' },
  card_expired:            { label: 'Card Expired',       action: 'Send 1-click card update link — they will pay once card is updated', urgency: 'medium' },
  do_not_honor:            { label: 'Bank Blocked',       action: 'Personal call required — bank is blocking, not the customer', urgency: 'high' },
  lost_card:               { label: 'Lost/Stolen Card',   action: 'Request new payment method via email', urgency: 'high' },
  stolen_card:             { label: 'Lost/Stolen Card',   action: 'Request new payment method via email', urgency: 'high' },
  card_velocity_exceeded:  { label: 'Velocity Limit',     action: 'Wait 24h and auto-retry — temporary bank limit', urgency: 'low' },
  processing_error:        { label: 'Processing Error',   action: 'Auto-retry in 24h — technical issue, not customer intent', urgency: 'low' },
  fraudulent:              { label: 'Fraud Flag',         action: 'Manual investigation — do not auto-retry', urgency: 'high' },
  generic_decline:         { label: 'Generic Decline',    action: 'Send card update + payment method options email', urgency: 'medium' },
  card_declined:           { label: 'Card Declined',      action: 'Send card update + payment method options email', urgency: 'medium' },
};

const analyzeDeclineIntelligence = (invoices: any[], charges: any[]) => {
  const perCustomer: any[] = [];

  invoices.forEach(inv => {
    const charge = charges.find((c: any) => c.invoice === inv.id);
    if (!charge) return;
    const code = charge.failure_code || charge.decline_code || null;
    if (!code) return;
    const meta = DECLINE_ACTION_MAP[code] || { label: 'Unknown Decline', action: 'Manual outreach required', urgency: 'medium' as const };
    perCustomer.push({
      customer_name: inv.customer_name,
      amount: inv.amount,
      decline_code: code,
      label: meta.label,
      recommended_action: meta.action,
      urgency: meta.urgency,
    });
  });

  // Aggregate by decline type
  const byType: Record<string, { count: number; total_amount: number; action: string; customers: string[] }> = {};
  perCustomer.forEach(cd => {
    if (!byType[cd.decline_code]) {
      byType[cd.decline_code] = { count: 0, total_amount: 0, action: cd.recommended_action, customers: [] };
    }
    byType[cd.decline_code].count++;
    byType[cd.decline_code].total_amount += cd.amount;
    byType[cd.decline_code].customers.push(cd.customer_name);
  });

  return {
    total_declined: perCustomer.length,
    payment_plan_candidates: perCustomer.filter(cd => cd.decline_code === 'insufficient_funds').length,
    card_update_needed: perCustomer.filter(cd => ['card_expired', 'generic_decline', 'card_declined'].includes(cd.decline_code)).length,
    auto_retry_candidates: perCustomer.filter(cd => ['card_velocity_exceeded', 'processing_error'].includes(cd.decline_code)).length,
    manual_outreach_needed: perCustomer.filter(cd => ['do_not_honor', 'fraudulent', 'lost_card', 'stolen_card'].includes(cd.decline_code)).length,
    by_type: byType,
    per_customer: perCustomer.slice(0, 10),
  };
};

const generateBasicForecast = (totalOverdue: number, recoveryRate: number) => {
  const forecast = [];
  let balance = 0;

  for (let day = 0; day <= 90; day += 1) {
    // Simulate collections
    const dailyCollection = (totalOverdue * recoveryRate / 90) *
                           (1 + Math.random() * 0.2);
    balance += dailyCollection;
    
    forecast.push({
      day,
      balance: Math.round(balance),
      collection: Math.round(dailyCollection),
    });
  }
  
  return forecast;
};

const detectAnomalies = (invoices: any[]): Array<{type: string; invoice_id: string; amount: number}> => {
  const anomalies: Array<{type: string; invoice_id: string; amount: number}> = [];

  // Check for duplicates (same customer + same amount)
  const amountGroups = new Map();
  invoices.forEach((inv: any) => {
    const key = `${inv.customer}_${inv.total}`;
    if (amountGroups.has(key)) {
      anomalies.push({ type: 'duplicate', invoice_id: inv.id, amount: inv.total / 100 });
    }
    amountGroups.set(key, inv.id);
  });

  // Check for amount spikes (invoice > 3x customer's average)
  const customerAmounts = new Map<string, number[]>();
  invoices.forEach((inv: any) => {
    const list = customerAmounts.get(inv.customer) || [];
    list.push(inv.total);
    customerAmounts.set(inv.customer, list);
  });
  invoices.forEach((inv: any) => {
    const list = customerAmounts.get(inv.customer) || [];
    if (list.length >= 2) {
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      if (inv.total > avg * 3) {
        anomalies.push({ type: 'amount_spike', invoice_id: inv.id, amount: inv.total / 100 });
      }
    }
  });

  // Check for fraud patterns (3+ invoices to same customer created within 7 days)
  const customerDates = new Map<string, number[]>();
  invoices.forEach((inv: any) => {
    const dates = customerDates.get(inv.customer) || [];
    dates.push(inv.created);
    customerDates.set(inv.customer, dates);
  });
  customerDates.forEach((dates, customerId) => {
    if (dates.length < 3) return;
    const sorted = [...dates].sort((a, b) => a - b);
    for (let i = 0; i <= sorted.length - 3; i++) {
      const windowDays = (sorted[i + 2] - sorted[i]) / 86400;
      if (windowDays <= 7) {
        const inv = invoices.find((v: any) => v.customer === customerId);
        if (inv) anomalies.push({ type: 'fraud_pattern', invoice_id: inv.id, amount: inv.total / 100 });
        break;
      }
    }
  });

  return anomalies;
};

const sendAuditResultsEmail = async (
  email: string,
  auditId: string,
  ar: any,
  dso: any,
  total: any
) => {
  const subject = `Your Cash Operations Analysis Complete—$${total.total.toLocaleString()} Opportunity`;

  const bodyText = `Hi there,

I completed the 48-hour audit of your cash operations.

KEY FINDINGS:
━━━━━━━━━━━━━━━━
Working Capital Stuck:        $${ar.total_overdue.toLocaleString()}
DSO Gap vs. Peers:             +${dso.gap} days (costing $${dso.annual_cost.toLocaleString()}/year)
AR Recovery Opportunity:       $${ar.delta.toLocaleString()} (30-90 day invoices)
Total Opportunity:             $${total.total.toLocaleString()}

BREAKDOWN:
• AR Recovery: $${ar.delta.toLocaleString()} (smart dunning + payment plans)
• DSO Improvement: $${dso.working_capital_freed.toLocaleString()} (4-day reduction)
• Cash Visibility: Priceless (90-day forecast)

YOUR NEXT STEP:
Start 14-day FREE pilot:
${process.env.FRONTEND_URL}/audit-results/${auditId}

Best,
RecoverAI Team
`;

  const bodyHtml = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hi there,</p>
  <p>I completed the 48-hour audit of your cash operations.</p>
  <h2>KEY FINDINGS:</h2>
  <ul>
    <li><strong>Working Capital Stuck:</strong> $${ar.total_overdue.toLocaleString()}</li>
    <li><strong>DSO Gap vs. Peers:</strong> +${dso.gap} days (costing $${dso.annual_cost.toLocaleString()}/year)</li>
    <li><strong>AR Recovery Opportunity:</strong> $${ar.delta.toLocaleString()} (30-90 day invoices)</li>
    <li><strong>Total Opportunity:</strong> $${total.total.toLocaleString()}</li>
  </ul>
  <h3>BREAKDOWN:</h3>
  <ul>
    <li>AR Recovery: $${ar.delta.toLocaleString()} (smart dunning + payment plans)</li>
    <li>DSO Improvement: $${dso.working_capital_freed.toLocaleString()} (4-day reduction)</li>
    <li>Cash Visibility: Priceless (90-day forecast)</li>
  </ul>
  <p><a href="${process.env.FRONTEND_URL}/audit-results/${auditId}">Start 14-day FREE pilot</a></p>
  <p>Best,<br/>RecoverAI Team</p>
</body>
</html>
  `;

  // Send via Resend
  await resendService.sendEmail({
    to: email,
    subject,
    bodyText,
    bodyHtml,
  });
};

/**
 * STEP 1 (NEW OTP FLOW): Send OTP to email
 * POST /api/audits/send-otp { email }
 * Returns: { verifyToken, devCode?, expiresIn }
 */
export const sendAuditOtp = async (req: Request, res: Response) => {
  const { email } = req.body;
  const handler = 'sendAuditOtp';

  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    logInfo(MODULE, handler, 'OTP request received', { email });

    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'dev';

    // DEV MODE: Simple hardcoded OTP (no Redis, no email)
    if (isDev) {
      const verifyToken = crypto.randomUUID();
      logInfo(MODULE, handler, 'DEV MODE: Hardcoded OTP 123456', { email });
      return res.json({
        verifyToken,
        devCode: '123456',
        expiresIn: 900,
      });
    }

    // PRODUCTION: Real OTP flow with Redis
    const redisAvailable = (redisClient as any)?.isOpen;

    // Check Redis dedup: same email can only request once per 24h
    if (redisAvailable) {
      try {
        const dedupKey = `audit:dedup:${email}`;
        const existingDedup = await (redisClient as any).get(dedupKey);
        if (existingDedup) {
          logInfo(MODULE, handler, 'Dedup blocked (already submitted in 24h)', { email });
          return res.status(409).json({
            error: 'Already submitted. Check your email or wait 24 hours.',
          });
        }
      } catch (dedupErr: any) {
        logInfo(MODULE, handler, 'Dedup check failed (continuing)', { error: dedupErr.message });
      }
    }

    // Generate OTP (6 digits)
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Generate verify token
    const verifyToken = crypto.randomUUID();

    // Store OTP in Redis (15 min TTL)
    if (redisAvailable) {
      try {
        const otpKey = `audit:otp:${email}`;
        await (redisClient as any).set(otpKey, JSON.stringify({ code: otp, createdAt: Date.now() }), { EX: 900 });

        const verifyKey = `audit:verify:${verifyToken}`;
        await (redisClient as any).set(verifyKey, email, { EX: 900 });

        logInfo(MODULE, handler, 'OTP stored in Redis', { email, otp: '***' });
      } catch (redisErr: any) {
        logInfo(MODULE, handler, 'Redis storage failed', { error: redisErr.message });
        return res.status(500).json({ error: 'Failed to send OTP' });
      }
    } else {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    // Send OTP via email
    try {
      await resendService.sendOTP({
        email,
        code: otp,
      });
      logInfo(MODULE, handler, 'OTP email sent', { email });
    } catch (emailErr: any) {
      logInfo(MODULE, handler, 'OTP email send failed', { error: emailErr.message });
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    return res.json({
      verifyToken,
      expiresIn: 900,
    });
  } catch (err: any) {
    logInfo(MODULE, handler, 'Error', { error: err.message });
    return res.status(400).json({ error: 'Failed to send OTP' });
  }
};

/**
 * STEP 2 (NEW OTP FLOW): Verify OTP and create audit request
 * POST /api/audits/verify-otp { verifyToken, code }
 * Returns: { auditId, stripeAuthUrl }
 */
export const verifyAuditOtp = async (req: Request, res: Response) => {
  const { verifyToken, code, email: frontendEmail } = req.body;
  const handler = 'verifyAuditOtp';

  try {
    // Validate input
    if (!verifyToken || !code) {
      return res.status(400).json({ error: 'Verify token and OTP code required' });
    }

    logInfo(MODULE, handler, 'OTP verification attempt', { verifyToken: verifyToken.substring(0, 8) });

    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'dev';
    let email = '';

    // DEV MODE: Simple check (no Redis)
    if (isDev) {
      if (code !== '123456') {
        logInfo(MODULE, handler, 'Invalid OTP (dev mode)', { code });
        return res.status(400).json({ error: 'Invalid code. Dev code is 123456.' });
      }
      logInfo(MODULE, handler, 'OTP verified (dev mode)', { verifyToken: verifyToken.substring(0, 8) });

      // In dev, email comes from frontend (we need it for the audit request)
      email = frontendEmail || `dev-user-${Date.now()}@example.com`;

      // Skip Redis cleanup, continue to create audit request
      // (rest of function handles audit creation)
    } else {
      // PRODUCTION: Redis-based verification

      const redisAvailable = (redisClient as any)?.isOpen;
      if (!redisAvailable) {
        return res.status(503).json({ error: 'Service temporarily unavailable' });
      }

      // Get email from verify token
      try {
        const verifyKey = `audit:verify:${verifyToken}`;
        email = await (redisClient as any).get(verifyKey);
        if (!email) {
          logInfo(MODULE, handler, 'Invalid or expired verify token', { verifyToken: verifyToken.substring(0, 8) });
          return res.status(404).json({ error: 'Invalid or expired OTP session' });
        }
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to retrieve email from Redis', { error: err.message });
        return res.status(400).json({ error: 'OTP session expired. Request a new one.' });
      }

      // Check lockout (5 wrong attempts = 1 hour lockout)
      try {
        const lockKey = `audit:lock:${email}`;
        const lockCount = await (redisClient as any).get(lockKey);
        if (lockCount && parseInt(lockCount) >= 5) {
          logInfo(MODULE, handler, 'Account locked (too many attempts)', { email });
          return res.status(429).json({
            error: 'Too many attempts. Try again in 1 hour.',
          });
        }
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to check lockout', { error: err.message });
        return res.status(500).json({ error: 'Verification failed' });
      }

      // Get stored OTP
      let storedCode: string | null = null;
      try {
        const otpKey = `audit:otp:${email}`;
        const storedOtpData = await (redisClient as any).get(otpKey);
        if (!storedOtpData) {
          logInfo(MODULE, handler, 'OTP expired or not found', { email });
          return res.status(400).json({ error: 'OTP expired. Request a new one.' });
        }
        const parsed = JSON.parse(storedOtpData);
        storedCode = parsed.code;
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to retrieve OTP from Redis', { error: err.message });
        return res.status(400).json({ error: 'OTP expired. Request a new one.' });
      }

      // Verify OTP code
      if (code !== storedCode) {
        try {
          const lockKey = `audit:lock:${email}`;
          const lockCount = await (redisClient as any).get(lockKey);
          const newCount = lockCount ? parseInt(lockCount) + 1 : 1;
          const attemptsLeft = 5 - newCount;

          // Set lockout with 1 hour expiry
          if (newCount === 1) {
            await (redisClient as any).set(lockKey, String(newCount), { EX: 3600 });
          } else {
            const current = await (redisClient as any).get(lockKey);
            const next = String(parseInt(current || '0') + 1);
            await (redisClient as any).set(lockKey, next, { EX: 3600 });
          }

          logInfo(MODULE, handler, 'Invalid OTP code', { email, attemptsLeft });
          return res.status(400).json({
            error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
          });
        } catch (err: any) {
          logInfo(MODULE, handler, 'Failed to handle lockout', { error: err.message });
          return res.status(500).json({ error: 'Verification failed' });
        }
      }

      logInfo(MODULE, handler, 'OTP verified successfully', { email });

      // Clean up Redis
      try {
        const otpKey = `audit:otp:${email}`;
        const verifyKey = `audit:verify:${verifyToken}`;
        await (redisClient as any).del([otpKey, verifyKey]);

        const dedupKey = `audit:dedup:${email}`;
        await (redisClient as any).set(dedupKey, '1', { EX: 86400 });
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to clean up Redis (non-blocking)', { error: err.message });
      }
    }

    // Update existing account's onboarding status to 'stripe_pending' if it exists
    const existingUser = await UserDB.findUserByEmail(email);
    if (existingUser) {
      try {
        await UserDB.updateOnboardingStatus(existingUser.id, 'stripe_pending');
        logInfo(MODULE, handler, 'Updated onboarding_status to stripe_pending', { userId: existingUser.id });
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to update onboarding_status (non-blocking)', { error: err.message });
      }
    }

    // Create audit_invite + audit_request (existing flow)
    let inviteToken: string;
    try {
      const invite = await AuditInvitesDB.createAuditInvite({
        email,
        createdByType: 'website',
      });
      inviteToken = invite.token;
    } catch (err: any) {
      logInfo(MODULE, handler, 'Failed to create audit invite', err.message);
      return res.status(500).json({ error: 'Failed to create audit invite' });
    }

    const auditResult = await AuditRequestsDB.createAuditRequest({
      token: inviteToken,
      companyName: email.split('@')[0],
      email,
    });

    const auditId = auditResult.id;

    logInfo(MODULE, handler, 'Audit request created after OTP verification', { auditId, email });

    // Archive any old in-progress audits for this email
    try {
      await AuditRequestsDB.archiveOldAudits(email, auditId);
      logInfo(MODULE, handler, 'Archived old audits for email', { email, newAuditId: auditId });
    } catch (err: any) {
      logInfo(MODULE, handler, 'Failed to archive old audits (non-blocking)', { error: err.message });
    }

    // Update audit status to mark OTP as verified
    try {
      await AuditRequestsDB.updateAuditStatus({
        id: auditId,
        status: 'otp_verified',
      });
      logInfo(MODULE, handler, 'Audit status updated to otp_verified', { auditId });
    } catch (err: any) {
      logInfo(MODULE, handler, 'Failed to update audit status (non-blocking)', { error: err.message });
    }

    // Generate Stripe OAuth URL
    let stripeAuthUrl: string;

    if (!process.env.STRIPE_CLIENT_ID) {
      logInfo(MODULE, handler, 'Stripe OAuth not configured', { auditId, email });
      return res.status(503).json({
        error: 'Stripe audit not available. Please contact support.',
        audit_id: auditId,
        needs_config: true,
      });
    }

    // DEMO MODE: Skip Stripe if DEMO_AUDIT_MODE enabled
    if (process.env.DEMO_AUDIT_MODE === 'true') {
      logInfo(MODULE, handler, 'Demo mode: redirecting to demo analysis', { auditId });
      stripeAuthUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/audit-results/${auditId}?demo=true`;
      // Auto-complete analysis for demo
      await AuditDB.updateAuditRequest(auditId, {
        status: 'complete',
        analysis: JSON.stringify({
          ar: {
            total_invoices: 42,
            total_overdue: 125000,
            by_stage: {
              stage1: { count: 12, amount: 45000, recovery_rate: 0.60 },
              stage2: { count: 8, amount: 35000, recovery_rate: 0.35 },
              stage3: { count: 5, amount: 25000, recovery_rate: 0.20 },
              stage4: { count: 2, amount: 20000, recovery_rate: 0.08 },
            },
            decline_intelligence: {
              total_declined: 5,
              payment_plan_candidates: 3,
              card_update_needed: 1,
              auto_retry_candidates: 1,
              manual_outreach_needed: 0,
              by_type: {
                insufficient_funds: { count: 3, total_amount: 42500, action: 'Offer 3–6 month payment plan — they want to pay but can\'t right now', customers: ['Acme Technologies', 'TechFlow Inc', 'CloudScale.io'] },
                card_expired: { count: 1, total_amount: 15750, action: 'Send 1-click card update link — they will pay once card is updated', customers: ['DataSuite Ltd'] },
                card_velocity_exceeded: { count: 1, total_amount: 9800, action: 'Wait 24h and auto-retry — temporary bank limit', customers: ['InnovateLabs'] },
              },
              per_customer: [
                { customer_name: 'Acme Technologies', amount: 24500, decline_code: 'insufficient_funds', label: 'Insufficient Funds', recommended_action: 'Offer 3–6 month payment plan', urgency: 'high' },
                { customer_name: 'TechFlow Inc', amount: 10000, decline_code: 'insufficient_funds', label: 'Insufficient Funds', recommended_action: 'Offer 3–6 month payment plan', urgency: 'high' },
                { customer_name: 'DataSuite Ltd', amount: 15750, decline_code: 'card_expired', label: 'Card Expired', recommended_action: 'Send 1-click card update link', urgency: 'medium' },
                { customer_name: 'CloudScale.io', amount: 8000, decline_code: 'insufficient_funds', label: 'Insufficient Funds', recommended_action: 'Offer 3–6 month payment plan', urgency: 'high' },
                { customer_name: 'InnovateLabs', amount: 9800, decline_code: 'card_velocity_exceeded', label: 'Velocity Limit', recommended_action: 'Wait 24h and auto-retry', urgency: 'low' },
              ],
            },
            current_recovery: 0.15,
            projected_recovery: 0.40,
            delta: 31250,
            previews: [
              { customer_name: 'Acme Technologies', customer_email: 'billing@acme.io', amount: 24500, daysOverdue: 67, status: 'open' },
              { customer_name: 'TechFlow Inc', customer_email: 'accounts@techflow.com', amount: 18200, daysOverdue: 45, status: 'open' },
              { customer_name: 'DataSuite Ltd', customer_email: 'finance@datasuite.com', amount: 15750, daysOverdue: 91, status: 'open' },
              { customer_name: 'CloudScale.io', customer_email: 'billing@cloudscale.io', amount: 12300, daysOverdue: 38, status: 'open' },
              { customer_name: 'InnovateLabs', customer_email: 'ar@innovatelabs.co', amount: 9800, daysOverdue: 120, status: 'open' },
              { customer_name: 'Nexus Systems', customer_email: 'payments@nexussys.com', amount: 8750, daysOverdue: 55, status: 'open' },
              { customer_name: 'Vertex Analytics', customer_email: 'billing@vertexai.com', amount: 7200, daysOverdue: 33, status: 'open' },
            ],
          },
          dso: {
            current_dso: 52,
            benchmark_dso: 38,
            gap: 14,
            cost_per_day: 1042,
            annual_cost: 14583,
            projected_dso: 48,
            working_capital_freed: 5833,
          },
          forecast: Array.from({ length: 90 }, (_, i) => ({
            day: i,
            balance: Math.round(i * 1000),
            collection: Math.round(Math.random() * 2000),
          })),
          anomalies: { duplicates: 2, duplicate_savings: 8500, amount_spikes: 1, fraud_patterns: 0 },
          total: {
            ar_recovery: 31250,
            dso_reduction: 5833,
            anomaly_savings: 8500,
            total: 45583,
            monthly_cost: 2500,
            monthly_recovery_fee: 0,
            roi: 17,
          },
        }),
        completed_at: new Date(),
      });
    } else {
      // PRODUCTION: Real Stripe OAuth
      stripeAuthUrl =
        `https://connect.stripe.com/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${process.env.STRIPE_CLIENT_ID}&` +
        `scope=read_write&` +
        `state=${auditId}`;
    }

    logInfo(MODULE, handler, 'Audit ready for Stripe OAuth', { auditId, demo: process.env.DEMO_AUDIT_MODE === 'true' });

    return res.json({
      auditId,
      stripeAuthUrl,
    });
  } catch (err: any) {
    logInfo(MODULE, handler, 'Error', { error: err.message });
    return res.status(400).json({ error: 'Failed to verify OTP' });
  }
};

/**
 * ═══════════════════════════════════════════════════════════════
 * MOTION 2: PUBLIC AUDIT REQUEST FORM
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * POST /api/audit-requests/submit
 * Public form submission (no auth required)
 * Creates audit_request, sends verification email
 */
export const submitAuditRequest = async (req: Request, res: Response) => {
  const handler = 'submitAuditRequest';
  try {
    const { email, company_name, details } = req.body;

    // Validation
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!company_name || typeof company_name !== 'string') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const normalized_email = email.toLowerCase().trim();
    const normalized_company = company_name.trim();

    // ─────────────────────────────────────────────────────────────
    // CHECK 1: Already PENDING/APPROVED/CONVERTED?
    // ─────────────────────────────────────────────────────────────
    const activeCheck = await pool.query(
      `SELECT status FROM audit_requests
       WHERE email = $1 AND status IN ('pending', 'approved', 'converted')
       LIMIT 1`,
      [normalized_email]
    );

    if (activeCheck.rows.length > 0) {
      const status = activeCheck.rows[0].status;
      if (status === 'pending') {
        return res.status(429).json({
          error: 'You already have a pending audit request. Check your email for verification link.',
          code: 'AUDIT_PENDING'
        });
      }
      if (status === 'approved') {
        return res.status(429).json({
          error: 'Great news! Your audit is approved. Check your email for setup link.',
          code: 'AUDIT_APPROVED'
        });
      }
      if (status === 'converted') {
        return res.status(429).json({
          error: 'You already have an active RecoverAI account. Please log in.',
          code: 'AUDIT_CONVERTED'
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CHECK 2: Recently REJECTED? (1-week cooldown period)
    // ─────────────────────────────────────────────────────────────
    const rejectionCheck = await pool.query(
      `SELECT rejected_at FROM audit_requests
       WHERE email = $1 AND status = 'rejected' AND rejected_at IS NOT NULL
       ORDER BY rejected_at DESC LIMIT 1`,
      [normalized_email]
    );

    if (rejectionCheck.rows.length > 0) {
      const rejectedAt = new Date(rejectionCheck.rows[0].rejected_at);
      const cooldownEnd = new Date(rejectedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const now = new Date();

      if (now < cooldownEnd) {
        const hoursLeft = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
        return res.status(429).json({
          error: `Your previous audit request was rejected. Please try again in ${hoursLeft} hours.`,
          code: 'AUDIT_REJECTED_COOLDOWN',
          cooldownUntil: cooldownEnd.toISOString()
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ✅ ALL CHECKS PASSED → CREATE NEW REQUEST WITH OTP
    // ─────────────────────────────────────────────────────────────
    // Generate verify_token for OTP flow (Motion 2 - public form)
    // Note: token field is reserved for Motion 1 (invites), requires FK to audit_invites
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'dev';

    // Create audit_request without token (public form uses verify_token instead)
    const result = await pool.query(
      `INSERT INTO audit_requests (email, company_name, status, verify_token, expires_at, created_at)
       VALUES ($1, $2, 'pending', $3, NOW() + INTERVAL '7 days', NOW())
       RETURNING id, email, company_name`,
      [normalized_email, normalized_company, verifyToken]
    );

    const request = result.rows[0];
    const requestId = request.id;

    // DEV MODE: Return hardcoded OTP (no email sent)
    if (isDev) {
      logInfo(MODULE, handler, 'DEV MODE: Audit request with OTP 123456', {
        email: '***',
        company: normalized_company,
      });
      return res.status(201).json({
        requestId,
        devCode: '123456',
        message: '[DEV] Use OTP: 123456',
      });
    }

    // PROD MODE: Generate and send OTP via email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis (expires in 15 minutes)
    try {
      await (redisClient as any).setex(`audit-otp:${requestId}`, 900, otp);
    } catch (redisErr: any) {
      logError(MODULE, handler, 'Failed to store OTP in Redis', redisErr);
      // Continue anyway - OTP won't be verifiable but request exists
    }

    // Send OTP email
    try {
      await resendService.sendEmail({
        to: normalized_email,
        subject: 'Your RecoverAI Audit Verification Code',
        bodyText: `Your verification code is: ${otp}\n\nThis code expires in 15 minutes.`,
        bodyHtml: `
          <h2>Verify Your Audit Request</h2>
          <p>Hi,</p>
          <p>We received a request to audit <strong>${normalized_company}</strong> for AR recovery opportunities.</p>
          <p>Your verification code is:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center;">${otp}</p>
          <p style="color: #666; font-size: 14px;">This code expires in 15 minutes.</p>
          <p>Questions? <a href="mailto:hello@recoverai.com">Contact us</a></p>
        `,
      });
    } catch (emailErr: any) {
      logError(MODULE, handler, 'Failed to send OTP email', emailErr);
      // Don't fail the request if email fails
    }

    logInfo(MODULE, handler, 'Audit request submitted with OTP', {
      email: '***',
      company: normalized_company,
    });

    return res.status(201).json({
      requestId,
      message: 'OTP sent to your email. Check spam folder if you don\'t see it.',
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to submit audit request', err);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
};

/**
 * POST /api/audit-requests/verify-email
 * Verify OTP from public form (Motion 2)
 */
export const verifyAuditEmail = async (req: Request, res: Response) => {
  const handler = 'verifyAuditEmail';
  try {
    const { requestId, otp } = req.body;

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: 'Request ID required' });
    }
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ error: 'OTP required' });
    }

    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'dev';

    // DEV MODE: Check hardcoded OTP
    if (isDev) {
      if (otp !== '123456') {
        return res.status(400).json({ error: 'Invalid OTP' });
      }
    } else {
      // PROD MODE: Check Redis OTP
      const storedOtp = await (redisClient as any).get(`audit-otp:${requestId}`);
      if (!storedOtp || storedOtp !== otp) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }
      // Delete OTP after successful verification
      await (redisClient as any).del(`audit-otp:${requestId}`);
    }

    // Find request by ID
    const result = await pool.query(
      `SELECT * FROM audit_requests WHERE id = $1 AND status = 'pending'`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already verified' });
    }

    const request = result.rows[0];

    // Mark as verified
    await pool.query(
      `UPDATE audit_requests SET email_verified_at = NOW(), status = 'verified' WHERE id = $1`,
      [request.id]
    );

    logInfo(MODULE, handler, 'Email verified', {
      email: '***',
      company: request.company_name,
    });

    // Send confirmation email
    try {
      await resendService.sendEmail({
        to: request.email,
        subject: 'Audit request confirmed - We\'ll review soon',
        bodyText: 'Thank you! We will review your audit request and send setup link within 24 hours.',
        bodyHtml: `
          <h2>Thank You!</h2>
          <p>Your email has been verified.</p>
          <p>We'll review your audit request for <strong>${request.company_name}</strong> and send you a setup link within 24 hours.</p>
          <p>Best,<br>The RecoverAI team</p>
        `,
      });
    } catch (emailErr: any) {
      logError(MODULE, handler, 'Failed to send confirmation email', emailErr);
    }

    return res.json({
      data: {
        success: true,
        message: 'Email verified! Check your inbox for next steps.',
        request_id: request.id,
        status: 'verified',
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to verify email', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
};

/**
 * GET /api/admin/audit-requests
 * List all audit requests (admin only)
 */
export const listAuditRequests = async (req: Request, res: Response) => {
  const handler = 'listAuditRequests';
  try {
    const { status } = req.query;

    let query = `SELECT ar.id, ar.email, ar.company_name, ar.status, ar.email_verified_at, ar.created_at, ar.reviewed_at, ar.token, it.token as invite_token
                 FROM audit_requests ar
                 LEFT JOIN invite_tokens it ON ar.id = it.audit_request_id
                 WHERE ar.token IS NULL
                 ORDER BY ar.created_at DESC LIMIT 100`;
    const params: any[] = [];

    if (status && typeof status === 'string') {
      query = `SELECT ar.id, ar.email, ar.company_name, ar.status, ar.email_verified_at, ar.created_at, ar.reviewed_at, ar.token, it.token as invite_token
               FROM audit_requests ar
               LEFT JOIN invite_tokens it ON ar.id = it.audit_request_id
               WHERE ar.token IS NULL AND ar.status = $1
               ORDER BY ar.created_at DESC LIMIT 100`;
      params.push(status);
    }

    const result = await pool.query(query, params);

    logInfo(MODULE, handler, 'Listed audit requests', {
      count: result.rows.length,
      status: status || 'all',
    });

    return res.json({
      data: {
        requests: result.rows.map((r: any) => {
          // Determine submission method
          let submissionMethod = 'email_otp';
          if (r.token && r.token.length > 0) {
            submissionMethod = 'invite'; // Motion 1
          }

          // Build setup URL if approved with invite token
          let setup_url = null;
          if (r.status === 'approved' && r.invite_token) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            setup_url = `${frontendUrl}/onboard?token=${r.invite_token}&email=${encodeURIComponent(r.email)}`;
          }

          return {
            id: r.id,
            email: r.email,
            company_name: r.company_name,
            status: r.status,
            submission_method: submissionMethod,
            email_verified_at: r.email_verified_at,
            created_at: r.created_at,
            reviewed_at: r.reviewed_at,
            setup_url,
            invite_token: r.invite_token,
            approval_link: `/admin/audits/${r.id}/approve`,
            rejection_link: `/admin/audits/${r.id}/reject`,
          };
        }),
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to list requests', err);
    return res.status(500).json({ error: 'Failed to list requests' });
  }
};

/**
 * POST /api/admin/audit-requests/:id/approve
 * Admin approves request, generates invite token, sends email
 */
export const approveAuditRequest = async (req: Request, res: Response) => {
  const handler = 'approveAuditRequest';
  try {
    const { id } = req.params;
    const admin_id = (req as any).userId;

    if (!admin_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get request
    const reqResult = await pool.query(
      `SELECT * FROM audit_requests WHERE id = $1`,
      [id]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = reqResult.rows[0];

    // Generate invite token
    const invite_token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    // Create invite_token
    const tokenResult = await pool.query(
      `INSERT INTO invite_tokens (token, email, company_name, expires_at, created_by_user_id, audit_request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING token`,
      [invite_token, request.email, request.company_name, expires_at, admin_id, id]
    );

    const token = tokenResult.rows[0].token;
    const setup_url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/onboard?token=${token}&email=${encodeURIComponent(request.email)}`;

    // Update audit_request
    await pool.query(
      `UPDATE audit_requests SET status = 'approved', reviewed_by_user_id = $1, reviewed_at = NOW() WHERE id = $2`,
      [admin_id, id]
    );

    // Send approval email
    try {
      await resendService.sendEmail({
        to: request.email,
        subject: 'Your RecoverAI audit is approved! 🎉',
        bodyText: `Your Audit is Approved!\n\nHi,\n\nGreat news! We've approved your audit request for ${request.company_name}.\n\nClick the link below to set up your AR recovery system:\n${setup_url}\n\nThis link expires in 7 days.\n\nQuestions? Contact us at hello@recoverai.com`,
        bodyHtml: `
          <h2>Your Audit is Approved!</h2>
          <p>Hi,</p>
          <p>Great news! We've approved your audit request for <strong>${request.company_name}</strong>.</p>
          <p>Click the button below to set up your AR recovery system:</p>
          <p><a href="${setup_url}" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; display: inline-block; font-weight: bold;">Start Setup</a></p>
          <p>This link expires in 7 days.</p>
          <p>Questions? <a href="mailto:hello@recoverai.com">Contact us</a></p>
        `,
      });
    } catch (emailErr: any) {
      logError(MODULE, handler, 'Failed to send approval email', emailErr);
    }

    logInfo(MODULE, handler, 'Audit request approved', {
      request_id: id,
      email: '***',
      company: request.company_name,
    });

    return res.json({
      data: {
        success: true,
        invite_token: token,
        setup_url,
        message: 'Approval email sent to founder',
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to approve request', err);
    return res.status(500).json({ error: 'Failed to approve request' });
  }
};

/**
 * POST /api/admin/audit-requests/:id/reject
 * Admin rejects request, sends rejection email
 */
export const rejectAuditRequest = async (req: Request, res: Response) => {
  const handler = 'rejectAuditRequest';
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const admin_id = (req as any).userId;

    if (!admin_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Rejection reason required' });
    }

    // Get request
    const reqResult = await pool.query(
      `SELECT * FROM audit_requests WHERE id = $1`,
      [id]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = reqResult.rows[0];

    // Update audit_request with rejection timestamp
    await pool.query(
      `UPDATE audit_requests SET status = 'rejected', reviewed_by_user_id = $1, reviewed_at = NOW(), rejected_at = NOW(), rejection_reason = $2 WHERE id = $3`,
      [admin_id, reason, id]
    );

    // Send rejection email
    try {
      await resendService.sendEmail({
        to: request.email,
        subject: 'Your RecoverAI audit request',
        bodyText: `Audit Request Status\n\nHi,\n\nThank you for your interest in RecoverAI. After review, we determined that ${request.company_name} isn't the right fit at this time.\n\nReason: ${reason}\n\nWe're always here if you'd like to discuss further. Feel free to reach out at hello@recoverai.com.\n\nBest,\nThe RecoverAI team`,
        bodyHtml: `
          <h2>Audit Request Status</h2>
          <p>Hi,</p>
          <p>Thank you for your interest in RecoverAI. After review, we determined that <strong>${request.company_name}</strong> isn't the right fit at this time.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>We're always here if you'd like to discuss further. Feel free to <a href="mailto:hello@recoverai.com">reach out</a>.</p>
          <p>Best,<br>The RecoverAI team</p>
        `,
      });
    } catch (emailErr: any) {
      logError(MODULE, handler, 'Failed to send rejection email', emailErr);
    }

    logInfo(MODULE, handler, 'Audit request rejected', {
      request_id: id,
      email: '***',
      reason,
    });

    return res.json({
      data: {
        success: true,
        message: 'Rejection email sent to founder',
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to reject request', err);
    return res.status(500).json({ error: 'Failed to reject request' });
  }
};

/**
 * GET /api/audits/validate-token
 * Validate invite token from email link
 * Used by Stage1 onboarding to verify token is valid
 */
export const validateInviteToken = async (req: Request, res: Response) => {
  const handler = 'validateInviteToken';
  try {
    const { token, email } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required', code: 'INVALID_TOKEN' });
    }

    // Find invite token
    const result = await pool.query(
      `SELECT it.*, ar.email as audit_email, ar.company_name
       FROM invite_tokens it
       LEFT JOIN audit_requests ar ON it.audit_request_id = ar.id
       WHERE it.token = $1 AND it.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired link', code: 'LINK_INVALID' });
    }

    const inviteToken = result.rows[0];

    // Validate email if provided
    if (email && typeof email === 'string' && inviteToken.email && inviteToken.email !== email) {
      return res.status(400).json({
        error: 'Email mismatch',
        code: 'EMAIL_MISMATCH',
        expectedEmail: inviteToken.email
      });
    }

    logInfo(MODULE, handler, 'Token validated', { email: '***' });

    return res.json({
      data: {
        valid: true,
        token,
        email: inviteToken.email || inviteToken.audit_email,
        company_name: inviteToken.company_name,
        expiresAt: inviteToken.expires_at,
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to validate token', err);
    return res.status(500).json({ error: 'Failed to validate token' });
  }
};

/**
 * GET /api/audits/check-stage
 * Check current onboarding stage for authenticated user
 */
export const checkOnboardingStage = async (req: Request, res: Response) => {
  const handler = 'checkOnboardingStage';
  try {
    const userId = (req as any).userId;
    const companyId = (req as any).companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get company onboarding stage
    const result = await pool.query(
      `SELECT onboarding_stage, account_type FROM companies WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = result.rows[0];

    logInfo(MODULE, handler, 'Checked onboarding stage', {
      stage: company.onboarding_stage,
      accountType: company.account_type,
    });

    return res.json({
      data: {
        stage: company.onboarding_stage || 'stage-1',
        accountType: company.account_type,
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to check stage', err);
    return res.status(500).json({ error: 'Failed to check stage' });
  }
};

/**
 * POST /api/audits/create-trial-account
 * Convert audit to trial account (user clicks "Start 14-Day Trial" on results page)
 * Creates company + user in trial mode + auto-login
 */
export const createTrialAccount = async (req: Request, res: Response) => {
  const { auditToken } = req.body;
  const handler = 'createTrialAccount';

  try {
    if (!auditToken) {
      return res.status(400).json({ error: 'Audit token required' });
    }

    // Find audit by token
    const auditRes = await pool.query(
      `SELECT * FROM audit_requests WHERE token = $1 AND expires_at > NOW()`,
      [auditToken]
    );

    if (auditRes.rows.length === 0) {
      return res.status(404).json({ error: 'Audit not found or link expired' });
    }

    const audit = auditRes.rows[0];

    logInfo(MODULE, handler, 'Creating trial account from audit', { email: '***' });

    // Check if user already exists
    const existingRes = await pool.query(
      `SELECT u.*, c.id as company_id FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
      [audit.email]
    );

    if (existingRes.rows.length > 0) {
      // User exists, just return their company
      const user = existingRes.rows[0];
      const accessToken = jwt.sign(
        { userId: user.id, companyId: user.company_id, email: user.email },
        config.jwtSecret || 'your-secret-key',
        { expiresIn: '30d' }
      );

      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as any,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return res.json({
        success: true,
        user: { id: user.id, email: user.email },
        company: { id: user.company_id },
      });
    }

    // Create new company in trial mode
    const companyRes = await pool.query(
      `INSERT INTO companies (name, account_type, trial_started_at, trial_ends_at, onboarding_status, created_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '14 days', $3, NOW())
       RETURNING id, name`,
      [audit.company_name || 'New Company', 'trial', 'trial_active']
    );

    const company = companyRes.rows[0];

    logInfo(MODULE, handler, 'Company created for trial', { companyId: company.id });

    // Create user for this company
    const tempPassword = Math.random().toString(36).substring(7);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userRes = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, company_id`,
      [company.id, audit.email, passwordHash, 'Founder', audit.email.split('@')[0], 'owner']
    );

    const user = userRes.rows[0];

    logInfo(MODULE, handler, 'User created for trial account', { userId: user.id });

    // Auto-login
    const accessToken = jwt.sign(
      { userId: user.id, companyId: user.company_id, email: user.email },
      config.jwtSecret || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as any,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Mark audit as converted
    await pool.query(
      `UPDATE audit_requests SET status = 'converted', user_id = $1 WHERE id = $2`,
      [user.id, audit.id]
    );

    return res.json({
      success: true,
      user: { id: user.id, email: user.email },
      company: { id: company.id, name: company.name },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to create trial account', err);
    return res.status(500).json({ error: 'Failed to create trial account' });
  }
};

/**
 * GET /api/audits/results/:token
 * Retrieve audit results by token (public, no auth required)
 * Returns cash clarity score, metrics, risks, billing errors, insights
 *
 * This is what displays on the beautiful AuditResults page after Stripe OAuth
 */
export const getAuditResultsByToken = async (req: Request, res: Response) => {
  const { token } = req.params;
  const handler = 'getAuditResultsByToken';

  try {
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Find audit by token
    const audit = await AuditDB.getAuditRequestByToken(token);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found or link expired' });
    }

    // Check if analysis is complete
    if (audit.status !== 'analysis_complete' && !audit.analysis_data) {
      return res.status(400).json({ error: 'Analysis not yet complete. Please wait and refresh.' });
    }

    // Parse analysis_data from JSONB
    const analysisData = typeof audit.analysis_data === 'string'
      ? JSON.parse(audit.analysis_data)
      : audit.analysis_data;

    if (!analysisData) {
      return res.status(400).json({ error: 'No analysis data found' });
    }

    // Return REAL audit data
    const results = {
      email: audit.email,
      token: audit.token,
      cashClarityScore: analysisData.cash_clarity_score || 0,
      availableCash: analysisData.available_cash || 0,
      runwayDays: analysisData.runway_days || 0,
      overdueAr: analysisData.overdue_ar || 0,
      avgDaysLate: analysisData.avg_days_late || 0,
      billingErrors: analysisData.billing_errors || {
        duplicates: { count: 0, value: 0 },
        spikes: { count: 0, value: 0 },
        gaps: { count: 0, value: 0 },
        failed_clusters: { count: 0, value: 0 },
        total_value: 0
      },
      topRisks: (analysisData.risks || []).slice(0, 3),
      aiInsights: (analysisData.insights || []),
    };

    logInfo(MODULE, handler, 'Audit results retrieved (REAL DATA)', {
      email: '***',
      score: results.cashClarityScore,
      billingErrorsValue: results.billingErrors.total_value
    });

    return res.json(results);
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to get audit results', err);
    return res.status(500).json({ error: 'Failed to retrieve audit results' });
  }
};
