import { Request, Response } from 'express';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logInfo } from '../utils/logger';
import { config } from '../config/env';
import resendService from '../services/resendService';
import { stripeService } from '../services/stripeService';
import { redisClient } from '../config/redis';
import * as CompanyDB from '../db/companies';
import * as UserDB from '../db/users';
import * as AuditDB from '../db/audits';
import * as AuditInvitesDB from '../db/auditInvites';
import * as AuditRequestsDB from '../db/auditRequests';

const MODULE = 'auditController';

/**
 * STEP 1: Create audit request (prospect enters email, gets OAuth link)
 */
export const createAuditRequest = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    logInfo(MODULE, 'createAuditRequest', `Email: ${email}`);

    // 1. Create audit_invite first (which generates its own token)
    let inviteToken: string;
    try {
      const invite = await AuditInvitesDB.createAuditInvite({
        email,
        createdByType: 'website'
      });
      inviteToken = invite.token;
    } catch (err: any) {
      logInfo(MODULE, 'createAuditRequest', 'Failed to create audit invite', err.message);
      return res.status(500).json({ error: 'Failed to create audit invite' });
    }

    // 2. Create audit_requests record
    const auditId = await AuditDB.createAuditRequest({
      token: inviteToken,
      companyName: email.split('@')[0],
      email
    });

    // 3. Check if Stripe OAuth is configured
    if (!process.env.STRIPE_CLIENT_ID) {
      logInfo(MODULE, 'createAuditRequest', 'Stripe OAuth not configured', { auditId, email });
      return res.status(503).json({
        error: 'Stripe audit not available. Please contact support.',
        audit_id: auditId,
        needs_config: true
      });
    }

    // 4. Generate Stripe OAuth URL OR demo analysis URL
    let stripeAuthUrl: string;

    // DEMO MODE: Skip Stripe if DEMO_AUDIT_MODE enabled
    if (process.env.DEMO_AUDIT_MODE === 'true') {
      logInfo(MODULE, 'createAuditRequest', 'Demo mode: auto-completing analysis', { auditId });

      // Auto-complete analysis for demo
      const mockAnalysis = {
        ar: {
          total_invoices: 42,
          total_overdue: 125000,
          by_stage: {
            stage1: { count: 12, amount: 45000, recovery_rate: 0.60 },
            stage2: { count: 8, amount: 35000, recovery_rate: 0.35 },
            stage3: { count: 5, amount: 25000, recovery_rate: 0.20 },
            stage4: { count: 2, amount: 20000, recovery_rate: 0.08 },
          },
          decline_breakdown: { soft: 3, soft_percent: 0.07, hard: 2, hard_percent: 0.05 },
          current_recovery: 0.15,
          projected_recovery: 0.40,
          delta: 31250,
          previews: [],
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
      };

      await AuditDB.updateAuditRequest(auditId, {
        status: 'complete',
        analysis: JSON.stringify(mockAnalysis),
        completed_at: new Date(),
      });

      // Redirect directly to results (no OAuth needed in demo)
      stripeAuthUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/audit-results/${auditId}?demo=true`;
    } else {
      // PRODUCTION: Real Stripe OAuth
      stripeAuthUrl =
        `https://connect.stripe.com/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${process.env.STRIPE_CLIENT_ID}&` +
        `scope=read_invoices,read_charges&` +
        `state=${auditId}`;
    }

    logInfo(MODULE, 'createAuditRequest', 'OAuth URL generated', { auditId, demo: process.env.DEMO_AUDIT_MODE === 'true' });

    return res.json({
      audit_id: auditId,
      stripe_oauth_url: stripeAuthUrl,
    });
  } catch (err: any) {
    logInfo(MODULE, 'createAuditRequest', 'Error', { error: err.message });
    return res.status(400).json({ error: err.message || 'Failed to start audit' });
  }
};

/**
 * STEP 2: Handle Stripe OAuth callback
 * Prospect approves → we get access token → trigger analysis
 */
export const handleStripeOAuthCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const auditId = state as string;

  try {
    logInfo(MODULE, 'handleStripeOAuthCallback', 'OAuth callback received', { auditId });

    // 1. Exchange code for access token
    const tokenResult = await stripeService.getAccessToken(code as string);

    if (tokenResult.error) {
      throw new Error(tokenResult.error);
    }

    // 2. Store in audit_requests table
    await AuditDB.updateAuditRequest(auditId, {
      stripe_account_id: tokenResult.stripe_user_id,
      stripe_access_token: tokenResult.access_token,
      status: 'oauth_complete',
    });
    
    logInfo(MODULE, 'handleStripeOAuthCallback', 'OAuth stored', { auditId });

    // 3. Trigger analysis (await so results are ready when user lands on results page)
    try {
      await analyzeAuditAsync(auditId);
    } catch (err: any) {
      logInfo(MODULE, 'analyzeAuditAsync', 'Analysis failed', { error: err.message });
      await AuditDB.updateAuditRequest(auditId, { status: 'failed' });
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
    
    const invoices = await stripe.invoices.list({ limit: 100 });
    const charges = await stripe.charges.list({ limit: 100 });
    
    const analyzed = invoices.data.map(inv => ({
      id: inv.id,
      customer_name: inv.customer_name || inv.customer || 'Unknown',
      customer_email: inv.customer_email,
      amount: inv.total / 100, // Stripe in cents
      created: inv.created,
      daysOverdue: Math.floor((Date.now() / 1000 - inv.created) / 86400),
      status: inv.status,
      decline_code: (charges.data.find((c: any) => c.invoice === inv.id) as any)
        ?.decline_code || null,
    }));
    
    // Segment by age
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
      decline_breakdown: classifyDeclines(charges.data as any),
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
    await AuditDB.updateAuditRequest(auditId, {
      status: 'complete',
      analysis: JSON.stringify({
        ar: arAnalysis,
        dso: dsoAnalysis,
        forecast: cashForecast,
        anomalies: anomalyImpact,
        total: totalOpportunity,
      }),
      completed_at: new Date(),
    });
    
    logInfo(MODULE, 'analyzeAuditAsync', 'Analysis stored', { auditId });
    
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
 * Prospect clicks "Start pilot" → we create account + onboard them
 */
export const convertAuditToPilot = async (req: Request, res: Response) => {
  const audit_id = typeof req.body.audit_id === 'string' ? req.body.audit_id : String(req.body.audit_id);
  const inviteToken = req.body.invite_token as string | undefined;

  try {
    logInfo(MODULE, 'convertAuditToPilot', 'Starting conversion', { audit_id, hasInvite: !!inviteToken });

    // 1. Get audit
    const audit = await AuditDB.getAuditRequest(audit_id);
    if (!audit || audit.status !== 'complete') {
      return res.status(400).json({ error: 'Audit not ready' });
    }

    // 2. Create company
    const companyName = audit.email.split('@')[1]; // "acme.com"
    const company = await CompanyDB.createCompany({
      name: companyName,
      email: audit.email,
    });

    // Update with stripe and pilot info
    await CompanyDB.updateCompany(company.id, {
      stripe_account_id: audit.stripe_account_id,
      stripe_api_key_encrypted: audit.stripe_access_token, // Note: should be encrypted in production
      account_type: 'pilot',
      pilot_mode: 'shadow',  // Start in shadow mode for review
      pilot_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      cash_balance_usd: 0,
    });

    logInfo(MODULE, 'convertAuditToPilot', 'Company created', {
      company_id: company.id,
    });

    // 3. Create user
    const tempPassword = Math.random().toString(36).substring(7);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const user = await UserDB.createUser({
      email: audit.email,
      passwordHash,
      companyId: company.id,
      firstName: 'Prospect',
      lastName: 'User',
      role: 'owner',
    });

    // 4. Create access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        companyId: company.id,
        email: user.email,
      },
      config.jwtSecret || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    logInfo(MODULE, 'convertAuditToPilot', 'User created', {
      user_id: user.id,
    });
    
    // 5. Send welcome email with login details
    await sendPilotWelcomeEmail(
      audit.email,
      tempPassword,
      company.id,
      audit.analysis.total.total
    );
    
    logInfo(MODULE, 'convertAuditToPilot', 'Welcome email sent');

    // 6. Mark audit request as converted (for tracking)
    try {
      await AuditRequestsDB.markAuditRequestAsConverted(audit.email);
    } catch (err: any) {
      logInfo(MODULE, 'convertAuditToPilot', 'Could not mark request as converted', { error: err.message });
    }

    // 7. Mark invite as used (prevents reuse)
    if (inviteToken) {
      try {
        await AuditInvitesDB.markAuditInviteAsUsed(inviteToken);
        logInfo(MODULE, 'convertAuditToPilot', 'Invite marked as used');
      } catch (err: any) {
        logInfo(MODULE, 'convertAuditToPilot', 'Could not mark invite as used', { error: err.message });
      }
    }

    // Set httpOnly cookie (auth middleware reads from cookies, not response body)
    const sameSitePolicy = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSitePolicy as any,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.json({
      user: { id: user.id, email: user.email },
      company: {
        id: company.id,
        name: company.name,
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

const classifyDeclines = (charges: any[]): any => {
  const soft = charges.filter((c: any) =>
    ['card_velocity_exceeded', 'processing_error'].includes(c.decline_code)
  ).length;

  const hard = charges.filter((c: any) =>
    ['lost_card', 'stolen_card', 'card_not_supported'].includes(c.decline_code)
  ).length;
  
  return {
    soft: soft,
    soft_percent: soft / charges.length || 0,
    hard: hard,
    hard_percent: hard / charges.length || 0,
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

  // Check for duplicates
  const amountGroups = new Map();
  invoices.forEach((inv: any) => {
    const key = `${inv.customer}_${inv.total}`;
    if (amountGroups.has(key)) {
      anomalies.push({
        type: 'duplicate',
        invoice_id: inv.id,
        amount: inv.total / 100,
      });
    }
    amountGroups.set(key, inv.id);
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

const sendPilotWelcomeEmail = async (
  email: string,
  password: string,
  companyId: string,
  opportunityAmount: number
) => {
  const subject = 'Your RecoverAI 14-Day Pilot is Live!';

  const bodyText = `Hi there,

Your 14-day pilot is ready. Here's your login:
Email: ${email}
Password: ${password} (change this immediately)

Login: ${process.env.FRONTEND_URL}/login

WHAT HAPPENS NEXT:
✓ Day 1-3: We analyze your AR, start smart dunning
✓ Day 5: First payments coming in
✓ Day 10: Mid-pilot review—see live results
✓ Day 14: Final review—ready for paid plan?

Your opportunity: $${opportunityAmount.toLocaleString()} in 90 days
Our cost: $2,500/month + 1% recovery (only if we deliver)

Questions? Reply to this email.

Best,
RecoverAI Team
`;

  const bodyHtml = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hi there,</p>
  <p>Your 14-day pilot is ready. Here's your login:</p>
  <p>
    <strong>Email:</strong> ${email}<br/>
    <strong>Password:</strong> ${password} (change this immediately)
  </p>
  <p><a href="${process.env.FRONTEND_URL}/login">Login to RecoverAI</a></p>
  <h3>WHAT HAPPENS NEXT:</h3>
  <ul>
    <li>Day 1-3: We analyze your AR, start smart dunning</li>
    <li>Day 5: First payments coming in</li>
    <li>Day 10: Mid-pilot review—see live results</li>
    <li>Day 14: Final review—ready for paid plan?</li>
  </ul>
  <p>
    <strong>Your opportunity:</strong> $${opportunityAmount.toLocaleString()} in 90 days<br/>
    <strong>Our cost:</strong> $2,500/month + 1% recovery (only if we deliver)
  </p>
  <p>Questions? Reply to this email.</p>
  <p>Best,<br/>RecoverAI Team</p>
</body>
</html>
  `;

  await resendService.sendEmail({
    to: email,
    subject,
    bodyText,
    bodyHtml,
  });
};

/**
 * VALIDATE INVITE TOKEN (called by FreeAuditSignup.tsx)
 * GET /api/audits/validate-invite?token=xxx
 * Returns: { valid: bool, email?: string, expired: bool }
 */
export const validateInvite = async (req: Request, res: Response) => {
  const { token } = req.query;

  try {
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        valid: false,
        expired: false,
        error: 'Token required',
      });
    }

    const validation = await AuditInvitesDB.validateAuditInvite(token);

    return res.json({
      valid: validation.valid,
      email: validation.email || undefined,
      expired: validation.expired,
    });
  } catch (err: any) {
    logInfo(MODULE, 'validateInvite', 'Error', { error: err.message });
    return res.status(400).json({
      valid: false,
      expired: false,
      error: 'Validation failed',
    });
  }
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
    const redisAvailable = (redisClient as any)?.isOpen;

    // Check Redis dedup: same email can only request once per 24h (skip if Redis unavailable)
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
        logInfo(MODULE, handler, 'Dedup check failed (continuing without it)', { error: dedupErr.message });
      }
    }

    // Generate OTP (6 digits)
    const otp = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

    // Generate verify token (always works, no Redis needed)
    const verifyToken = crypto.randomUUID();

    // Store OTP in Redis (15 min TTL) - gracefully handle Redis failures
    if (redisAvailable) {
      try {
        const otpKey = `audit:otp:${email}`;
        await (redisClient as any).setex(otpKey, 900, JSON.stringify({ code: otp, createdAt: Date.now() }));

        const verifyKey = `audit:verify:${verifyToken}`;
        await (redisClient as any).setex(verifyKey, 900, email);

        logInfo(MODULE, handler, 'OTP stored in Redis', { email, otp: isDev ? otp : '***' });
      } catch (redisErr: any) {
        logInfo(MODULE, handler, 'Redis storage failed (continuing without persistence)', { error: redisErr.message });
        // In dev mode, this is OK - user can still use the OTP displayed in response
      }
    } else {
      logInfo(MODULE, handler, 'Redis unavailable (dev mode - OTP will display as devCode)', { email });
    }

    // Send OTP via email (skip in dev)
    if (!isDev) {
      try {
        await resendService.sendOTP({
          email,
          code: otp,
        });
        logInfo(MODULE, handler, 'OTP email sent', { email });
      } catch (emailErr: any) {
        logInfo(MODULE, handler, 'OTP email send failed (non-blocking)', { error: emailErr.message });
        // Don't fail the request — user can still verify if they have the OTP
      }
    }

    return res.json({
      verifyToken,
      devCode: isDev ? otp : undefined,
      expiresIn: 900, // 15 minutes
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
  const { verifyToken, code } = req.body;
  const handler = 'verifyAuditOtp';

  try {
    // Validate input
    if (!verifyToken || !code) {
      return res.status(400).json({ error: 'Verify token and OTP code required' });
    }

    logInfo(MODULE, handler, 'OTP verification attempt', { verifyToken: verifyToken.substring(0, 8) });

    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'dev';
    const redisAvailable = (redisClient as any)?.isOpen;

    let email = '';

    // Get email from verify token (skip in dev without Redis)
    if (redisAvailable) {
      try {
        const verifyKey = `audit:verify:${verifyToken}`;
        email = await (redisClient as any).get(verifyKey);
        if (!email) {
          logInfo(MODULE, handler, 'Invalid or expired verify token', { verifyToken: verifyToken.substring(0, 8) });
          return res.status(404).json({ error: 'Invalid or expired OTP session' });
        }
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to retrieve email from Redis', { error: err.message });
        if (!isDev) throw err;
        // In dev, continue without email - user will need to provide it separately
        return res.status(400).json({ error: 'OTP session expired. Request a new one.' });
      }
    } else {
      // In dev mode without Redis, user can proceed but email needs to come from somewhere
      // For now, we'll use a placeholder - the email should come from frontend state
      logInfo(MODULE, handler, 'Redis unavailable, dev mode - accepting verify token without validation');
      // Accept any verify token in dev without Redis (since we can't store it)
      email = `dev-user-${verifyToken.substring(0, 8)}@example.com`;
    }

    // Check lockout (5 wrong attempts = 1 hour lockout) - skip in dev without Redis
    if (redisAvailable) {
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
        // Continue without lockout check in case of Redis failure
      }
    }

    // Get stored OTP (in dev, default is '123456')
    let storedCode = isDev ? '123456' : null;

    if (redisAvailable && !isDev) {
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
    }

    // Verify OTP code
    if (code !== storedCode) {
      if (redisAvailable) {
        try {
          const lockKey = `audit:lock:${email}`;
          const lockCount = await (redisClient as any).get(lockKey);
          const newCount = lockCount ? parseInt(lockCount) + 1 : 1;
          const attemptsLeft = 5 - newCount;

          // Set lockout with 1 hour expiry on first wrong attempt
          if (newCount === 1) {
            await (redisClient as any).setex(lockKey, 3600, String(newCount));
          } else {
            await (redisClient as any).incr(lockKey);
          }

          logInfo(MODULE, handler, 'Invalid OTP code', { email, attemptsLeft });
          return res.status(400).json({
            error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
          });
        } catch (err: any) {
          logInfo(MODULE, handler, 'Failed to handle lockout on invalid code', { error: err.message });
        }
      }

      logInfo(MODULE, handler, 'Invalid OTP code', { email });
      return res.status(400).json({ error: 'Invalid code. Please try again.' });
    }

    logInfo(MODULE, handler, 'OTP verified successfully', { email });

    // Clear OTP and verify token (non-blocking in case of Redis failure)
    if (redisAvailable) {
      try {
        const otpKey = `audit:otp:${email}`;
        const verifyKey = `audit:verify:${verifyToken}`;
        await (redisClient as any).del(otpKey);
        await (redisClient as any).del(verifyKey);

        // Set dedup (24 hour lockout on same email)
        const dedupKey = `audit:dedup:${email}`;
        await (redisClient as any).setex(dedupKey, 86400, '1');
      } catch (err: any) {
        logInfo(MODULE, handler, 'Failed to clean up Redis (non-blocking)', { error: err.message });
        // Don't fail the request - continue to create audit
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

    const auditId = await AuditDB.createAuditRequest({
      token: inviteToken,
      companyName: email.split('@')[0],
      email,
    });

    logInfo(MODULE, handler, 'Audit request created after OTP verification', { auditId, email });

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
            decline_breakdown: { soft: 3, soft_percent: 0.07, hard: 2, hard_percent: 0.05 },
            current_recovery: 0.15,
            projected_recovery: 0.40,
            delta: 31250,
            previews: [],
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
        `scope=read_invoices,read_charges&` +
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
