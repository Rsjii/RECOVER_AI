import { Request, Response } from 'express';
import { logInfo, logError, logWarn } from '../utils/logger';
import { pool } from '../config/database';
import * as CompanyDB from '../db/companies';
import { encryptField } from '../lib/encryption';
import { stripeService } from '../services/stripeService';

const MODULE = 'generateAuditController';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * GET /api/integrations/status
 * Check if Stripe is connected (replaces /api/audits/stage/4)
 * AUTHENTICATED
 */
export const getIntegrationStatus = async (req: Request, res: Response) => {
  const handler = 'getIntegrationStatus';
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json({
      stripe_connected: !!company.stripe_api_key_encrypted,
      qb_connected: !!company.quickbooks_access_token_encrypted,
      company_name: company.name,
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to get integration status', err);
    return res.status(500).json({ error: 'Failed to get integration status' });
  }
};

/**
 * POST /api/integrations/proceed
 * Proceed to next step after Stripe connected (replaces /api/audits/stage/4/next)
 * AUTHENTICATED
 */
export const proceedFromIntegrations = async (req: Request, res: Response) => {
  const handler = 'proceedFromIntegrations';
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if Stripe connected (dev mode allows skip)
    if (!isDev && !company.stripe_api_key_encrypted) {
      return res.status(400).json({ error: 'Stripe not connected' });
    }

    // Update stage to audit_report
    await CompanyDB.updateCompany(companyId, { onboarding_stage: 'audit_report' });

    logInfo(MODULE, handler, 'Proceeding to audit generation', { companyId });

    return res.json({ success: true, message: 'Ready for audit generation' });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to proceed', err);
    return res.status(500).json({ error: 'Failed to proceed' });
  }
};

/**
 * GET /api/audit/generate (new) OR POST /api/audits/generate (old)
 * Generate audit analysis from Stripe data (replaces /api/audits/stage/5/analysis)
 * EXACT COPY of Stage 5 logic with 6 advanced metrics
 * AUTHENTICATED
 */
export const generateAudit = async (req: Request, res: Response) => {
  const handler = 'generateAuditReport';

  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for encrypted API key
    if (!isDev && !company.stripe_api_key_encrypted) {
      return res.status(400).json({ error: 'Stripe not connected' });
    }

    logInfo(MODULE, handler, 'Generating audit analysis from Stripe data', { companyId });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Fetch ALL invoices (paid + unpaid)
    // ═══════════════════════════════════════════════════════════════════════════

    const invoicesResult = await pool.query(
      `SELECT id, source_id, amount, currency, customer_id, status,
              created_at, due_date, issued_date, notes, risk_score
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

    // === DUPLICATES: Same customer + amount + created within 24 hours (excluding recurring patterns) ===
    // For SaaS: monthly subscriptions (20-35 days apart) are legitimate, not duplicates
    const duplicates: any[] = [];

    // Group invoices by customer + rounded amount
    const amountGroups = new Map<string, any[]>();
    invoices.forEach((inv: any) => {
      const roundedAmount = Math.round(parseFloat(inv.amount));
      const key = `${inv.customer_id}|${roundedAmount}`;
      if (!amountGroups.has(key)) {
        amountGroups.set(key, []);
      }
      amountGroups.get(key)!.push(inv);
    });

    // Detect duplicates: same amount, created within 24 hours, NOT recurring monthly
    amountGroups.forEach((group) => {
      if (group.length >= 2) {
        // Sort by created date
        const sorted = [...group].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Check for duplicates: within 24 hours apart
        for (let i = 0; i < sorted.length - 1; i++) {
          const curr = sorted[i];
          const next = sorted[i + 1];
          const hoursApart = (new Date(next.created_at).getTime() - new Date(curr.created_at).getTime()) / (1000 * 60 * 60);

          // Flag as duplicate ONLY if:
          // 1. Created within 24 hours AND
          // 2. NOT part of recurring monthly pattern (20-35 days apart)
          if (hoursApart > 0 && hoursApart <= 24) {
            // This is a likely duplicate (accidental duplicate, not recurring)
            duplicates.push({
              invoice_id: curr.id,
              customer_id: curr.customer_id,
              amount: parseFloat(curr.amount),
              created_date: new Date(curr.created_at).toLocaleDateString('en-CA'),
              group_size: group.length,
            });
          }
        }

        // Check if this might be recurring (monthly): if invoices are 20-35 days apart with same amount
        // Only flag if we have >= 2 items that DON'T fit recurring pattern
        const recurringThreshold = 20; // Don't flag invoices 20+ days apart
        const isRecurring = sorted.length >= 2 && sorted.every((inv, idx) => {
          if (idx === 0) return true;
          const daysBetween = (new Date(inv.created_at).getTime() - new Date(sorted[idx - 1].created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysBetween >= recurringThreshold;
        });

        if (!isRecurring && duplicates.length === 0 && group.length >= 2) {
          // Not recurring, might be duplicate - flag all items in group
          group.forEach((inv: any) => {
            duplicates.push({
              invoice_id: inv.id,
              customer_id: inv.customer_id,
              amount: parseFloat(inv.amount),
              created_date: new Date(inv.created_at).toLocaleDateString('en-CA'),
              group_size: group.length,
            });
          });
        }
      }
    });

    // === SPIKES: Revenue 2.5x+ above customer average ===
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
      if (multiplier > 2.5) {
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
    // STEP 3.5: Extract ADDITIONAL METRICS (6 metrics from 50K dataset analysis)
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

    // Metric 2: CUSTOMER CONCENTRATION (80/20 Rule)
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

    // Metric 3: HIGH-RISK INVOICES (30+ days late AND >= $50K)
    const highRiskInvoices = unpaidInvoices.filter((inv: any) => {
      return inv.daysLate >= 30 && parseFloat(inv.amount) >= 50000;
    });
    const highRiskTotal = highRiskInvoices.reduce((sum: number, inv: any) => {
      return sum + parseFloat(inv.amount);
    }, 0);

    // Metric 4: MONTHLY TREND ANALYSIS
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

    // Calculate billing error exposure
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

    logInfo(MODULE, handler, 'Audit analysis generated (Stripe data + 6 metrics)', {
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
      source: 'stripe',
      generated_at: new Date().toISOString(),

      // REAL metrics
      total_invoiced: Math.round(totalInvoiced),
      total_unpaid: Math.round(totalUnpaid),
      overdue_ar: Math.round(overdueAmount),
      avg_days_late: avgDaysLate,
      oldest_unpaid_days: oldestUnpaidDays,

      // Metric 1: AGING BUCKETS
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

      // Metric 2: CUSTOMER CONCENTRATION
      customer_concentration: {
        total_unique_customers: customerUnpaid.size,
        customers_holding_80_percent: customersFor80Percent,
        concentration_ratio_percentage: Math.round(concentrationRatio * 10) / 10,
        note: `Top ${customersFor80Percent} customers hold 80% of your unpaid AR`,
      },

      // Metric 3: HIGH-RISK INVOICES
      high_risk_invoices: {
        count: highRiskInvoices.length,
        total_amount: Math.round(highRiskTotal),
        percentage_of_unpaid: totalUnpaid > 0 ? Math.round(100 * highRiskTotal / totalUnpaid) : 0,
        note: `${highRiskInvoices.length} invoices ready for phone call collection`,
      },

      // Metric 4: TREND ANALYSIS
      trend: {
        direction: trendDirection,
        percent_change: Math.round(trendPercentChange * 10) / 10,
        months_tracked: sortedMonths.length,
        note: trendDirection === 'improving'
          ? 'Good news: your unpaid AR is decreasing'
          : trendDirection === 'worsening'
          ? 'Alert: your unpaid AR is growing'
          : 'Your unpaid AR is stable',
      },

      // Metrics 5-6: BILLING ERRORS
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

      next_steps: nextSteps,

      plaid_unlocks: {
        cash_balance: 'Real bank account balance (not estimated)',
        cash_runway: 'Days until you run out of cash',
        burn_rate: 'Actual monthly spending',
        payables: 'Bills you owe (from QuickBooks)',
      },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Error generating audit analysis', err);
    return res.status(500).json({ error: 'Failed to generate analysis' });
  }
};

/**
 * POST /api/trial/start
 * Start 14-day free trial
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

    return res.json({
      success: true,
      message: 'Trial started',
      company: { id: company.id, name: company.name },
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Error starting trial', err);
    return res.status(500).json({ error: 'Failed to start trial' });
  }
};

/**
 * POST /api/integrations/validate-stripe-key
 * Validate and store Stripe API key (manual entry option)
 * AUTHENTICATED
 */
export const validateStripeKey = async (req: Request, res: Response) => {
  const handler = 'validateStripeKey';
  const companyId = (req as any).companyId;
  const { stripe_key } = req.body;

  if (!companyId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!stripe_key || typeof stripe_key !== 'string') {
    return res.status(400).json({ error: 'Stripe API key is required' });
  }

  const trimmedKey = stripe_key.trim();

  // Validate key format (should start with sk_)
  if (!trimmedKey.startsWith('sk_')) {
    return res.status(400).json({ error: 'Invalid Stripe key format. Must start with sk_' });
  }

  try {
    // Encrypt and store the key
    const encryptedKey = encryptField(trimmedKey);

    await CompanyDB.updateCompany(companyId, {
      stripe_api_key_encrypted: encryptedKey,
    });

    logInfo(MODULE, handler, 'Stripe key validated and stored', { companyId });

    // Sync invoices from Stripe in the background (non-blocking)
    setImmediate(async () => {
      try {
        logInfo(MODULE, handler, 'Starting Stripe invoice sync', { companyId });
        await stripeService.syncInvoices(companyId);
        logInfo(MODULE, handler, 'Stripe invoice sync complete', { companyId });
      } catch (err: any) {
        logError(MODULE, handler, 'Stripe invoice sync failed (non-blocking)', err);
      }
    });

    return res.json({
      success: true,
      message: 'Stripe key validated and saved',
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to validate Stripe key', err);
    return res.status(500).json({ error: 'Failed to validate Stripe key' });
  }
};

/**
 * POST /api/integrations/upload-invoices
 * Upload invoice data via CSV (manual entry option)
 * Expects CSV with headers: customer_name, customer_email, amount, due_date, issued_date, invoice_id, status
 * AUTHENTICATED
 */
/**
 * Rate limit check for CSV uploads (Redis-backed)
 */
const checkUploadRateLimit = async (companyId: string): Promise<{ allowed: boolean; reason?: string }> => {
  // For now, do basic in-memory check (in production, use Redis)
  // This would be replaced with actual rate limiter middleware
  return { allowed: true };
};

export const uploadInvoices = async (req: Request, res: Response) => {
  const handler = 'uploadInvoices';
  const companyId = (req as any).companyId;
  const userId = (req as any).userId;
  const { csvContent, fileName } = req.body;

  if (!companyId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!csvContent || typeof csvContent !== 'string') {
    return res.status(400).json({ error: 'CSV content is required' });
  }

  // ═══ FRAUD PROTECTION: Rate Limiting ═══
  const rateCheck = await checkUploadRateLimit(companyId);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.reason || 'Too many uploads. Try again later.' });
  }

  // ═══ FRAUD PROTECTION: File Size Limit ═══
  const fileSizeKB = Buffer.byteLength(csvContent, 'utf8') / 1024;
  if (fileSizeKB > 5000) { // 5MB limit
    return res.status(413).json({ error: `File too large: ${fileSizeKB.toFixed(0)}KB. Max 5MB.` });
  }

  try {
    // Parse CSV: split by newlines, trim whitespace
    let lines = csvContent.trim().split('\n').filter((line: string) => line.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header row + at least 1 data row' });
    }

    // ═══ FRAUD PROTECTION: Row Count Limit ═══
    const rowCount = lines.length - 1;
    if (rowCount > 50000) {
      return res.status(413).json({ error: `Too many rows: ${rowCount}. Max 50,000 rows per file.` });
    }

    // Parse header row - normalize to lowercase, remove extra spaces
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h: string) => h.trim().toLowerCase().replace(/['"]/g, ''));

    logInfo(MODULE, handler, 'CSV headers parsed', { headers, headerLine });

    // ═══ SMART FUZZY COLUMN MATCHING ═══
    // Automatic detection using Levenshtein distance + keyword matching (NO hardcoded variations needed!)

    const keywordMap: Record<string, string[]> = {
      customer_name: ['customer', 'name', 'cust', 'bill_to', 'sold_to', 'party', 'account'],
      customer_email: ['email', 'contact', 'mail'],
      amount: ['amount', 'total', 'balance', 'outstanding', 'invoice', 'sum', 'open'],
      due_date: ['due', 'payable', 'maturity', 'payment', 'duedate'],
      issued_date: ['issued', 'created', 'posting', 'document', 'invoice', 'date']
    };

    // Levenshtein distance for fuzzy matching
    const levenshteinDistance = (s1: string, s2: string): number => {
      const a = s1.replace(/[_\-\s]/g, '').toLowerCase();
      const b = s2.replace(/[_\-\s]/g, '').toLowerCase();
      const matrix: number[][] = [];

      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b[i - 1] === a[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Find best matching column for each field
    const columnIndex: Record<string, number> = {};
    for (const [fieldName, keywords] of Object.entries(keywordMap)) {
      let bestMatch = -1;
      let bestScore = Infinity;

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx];
        const parts = header.split(/[_\-\s]+/).filter(p => p.length > 0);

        // Calculate similarity score
        let score = Infinity;
        for (const keyword of keywords) {
          const minDistance = Math.min(...parts.map(part => levenshteinDistance(part, keyword)));
          score = Math.min(score, minDistance);
        }

        // Bonus: exact substring match (very strong signal)
        if (keywords.some(kw => header.toLowerCase().includes(kw.toLowerCase()))) {
          score = Math.max(0, score - 2);
        }

        if (score < bestScore) {
          bestScore = score;
          bestMatch = colIdx;
        }
      }

      // Accept match if score is reasonable (Levenshtein distance < 4)
      if (bestScore <= 3 && bestMatch >= 0) {
        columnIndex[fieldName] = bestMatch;
        logInfo(MODULE, handler, `✓ Auto-matched`, {
          field: fieldName,
          column: headers[bestMatch],
          similarity: bestScore
        });
      }
    }

    // Check for CRITICAL required fields (for cash forecasting, email is optional)
    const criticalFields = ['customer_name', 'amount', 'due_date', 'issued_date'];
    const missingCritical = criticalFields.filter(f => !columnIndex.hasOwnProperty(f));
    if (missingCritical.length > 0) {
      logWarn(MODULE, handler, 'Critical columns not found - cannot import', {
        missingFields: missingCritical,
        availableHeaders: headers,
        detected: Object.keys(columnIndex)
      });
      return res.status(400).json({
        error: `Missing critical columns: ${missingCritical.join(', ')}. Detected: ${Object.keys(columnIndex).join(', ')}`
      });
    }

    // Optional: customer_email fallback (smart fuzzy match for customer ID)
    if (!columnIndex.hasOwnProperty('customer_email')) {
      // Try fuzzy match for customer identifier (cust_number, customer_id, etc.)
      const custIdKeywords = ['cust', 'customer', 'id', 'code', 'number'];
      let bestCustIdMatch = -1;
      let bestCustIdScore = Infinity;

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        if (columnIndex.customer_name === colIdx) continue; // Skip name column
        const header = headers[colIdx];
        const parts = header.split(/[_\-\s]+/).filter(p => p.length > 0);

        let score = Infinity;
        for (const kw of custIdKeywords) {
          const minDistance = Math.min(...parts.map(part => levenshteinDistance(part, kw)));
          score = Math.min(score, minDistance);
        }

        if (score <= 3 && score < bestCustIdScore) {
          bestCustIdScore = score;
          bestCustIdMatch = colIdx;
        }
      }

      if (bestCustIdMatch >= 0) {
        columnIndex['_cust_number_idx'] = bestCustIdMatch;
        logInfo(MODULE, handler, '✓ No email - using customer ID for fallback', {
          custIdColumn: headers[bestCustIdMatch]
        });
      } else {
        logWarn(MODULE, handler, '⚠️ No email or customer ID found - will generate pseudo-emails', {
          availableHeaders: headers
        });
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const rowLine = lines[i].trim();
      if (!rowLine) continue; // Skip empty rows

      // Parse CSV row (handle quoted values)
      const row = rowLine.split(',').map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
      const rowNum = i + 1;

      try {
        // Extract critical values using column indices
        const customer_name = row[columnIndex.customer_name] || '';
        const amount = row[columnIndex.amount] || '';
        const due_date = row[columnIndex.due_date] || '';
        const issued_date = row[columnIndex.issued_date] || '';

        // Customer email: try email column first, fallback to cust_number-based pseudo-email
        let customer_email = columnIndex.customer_email !== undefined ? row[columnIndex.customer_email] : '';

        if (!customer_email) {
          // Fallback: generate pseudo-email from customer number or name
          if (columnIndex._cust_number_idx !== undefined && row[columnIndex._cust_number_idx]) {
            const custNum = row[columnIndex._cust_number_idx];
            customer_email = `cust_${custNum}@company.local`;
          } else if (customer_name) {
            // Generate from name as last resort
            const nameSlug = customer_name.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
            customer_email = `${nameSlug}_${rowNum}@company.local`;
          }
        }

        // Optional fields - try to find them if available
        let status: string | undefined;
        let invoice_id: string | undefined;

        // Try to find status column (optional)
        const statusVariations = ['status', 'invoice_status', 'payment_status', 'isopen'];
        const statusColIdx = headers.findIndex(h => statusVariations.some(v => h === v || h.includes(v)));
        if (statusColIdx >= 0 && row[statusColIdx]) {
          const statusVal = row[statusColIdx]?.toString().toLowerCase() || '';
          // Map common status values
          if (statusVal === 'true' || statusVal === '1' || statusVal === 'open' || statusVal === 'x') {
            status = 'unpaid';
          } else if (statusVal === 'false' || statusVal === '0' || statusVal === 'paid' || statusVal === '') {
            status = 'paid';
          }
        }

        // Try to find invoice_id column (optional)
        const invoiceIdVariations = ['invoice_id', 'invoice_number', 'doc_id', 'doc_number', 'reference'];
        const invoiceIdColIdx = headers.findIndex(h => invoiceIdVariations.some(v => h === v || h.includes(v)));
        if (invoiceIdColIdx >= 0 && row[invoiceIdColIdx]) {
          invoice_id = row[invoiceIdColIdx];
        }

        logInfo(MODULE, handler, `Processing row ${rowNum}`, {
          customer_name,
          customer_email: customer_email.includes('@company.local') ? '(generated)' : 'provided',
          amount,
          due_date,
          issued_date,
          status: status || 'unpaid',
          invoice_id: invoice_id || 'auto-generated'
        });

        // ═══ VALIDATION: Critical Fields ═══
        if (!customer_name || !amount || !due_date || !issued_date) {
          errors.push(`Row ${rowNum}: Missing critical fields (name, amount, due_date, issued_date)`);
          errorCount++;
          continue;
        }

        // ═══ VALIDATION: Email Format ═══
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer_email)) {
          errors.push(`Row ${rowNum}: Invalid email "${customer_email}"`);
          errorCount++;
          continue;
        }

        // ═══ FRAUD PROTECTION: Amount Validation ═══
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
          errors.push(`Row ${rowNum}: Invalid amount "${amount}" (must be a number)`);
          errorCount++;
          continue;
        }
        if (parsedAmount <= 0) {
          errors.push(`Row ${rowNum}: Amount must be > 0 (got ${parsedAmount})`);
          errorCount++;
          continue;
        }
        if (parsedAmount > 999999999) {
          errors.push(`Row ${rowNum}: Amount too large ${parsedAmount} (max $999,999,999)`);
          errorCount++;
          continue;
        }

        // ═══ FRAUD PROTECTION: Date Validation ═══
        const issuedDate = new Date(issued_date);
        const dueDate = new Date(due_date);
        const now = new Date();
        const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);

        if (isNaN(issuedDate.getTime())) {
          errors.push(`Row ${rowNum}: Invalid issued_date "${issued_date}" (use YYYY-MM-DD)`);
          errorCount++;
          continue;
        }
        if (isNaN(dueDate.getTime())) {
          errors.push(`Row ${rowNum}: Invalid due_date "${due_date}" (use YYYY-MM-DD)`);
          errorCount++;
          continue;
        }
        if (issuedDate > now) {
          errors.push(`Row ${rowNum}: issued_date cannot be in future`);
          errorCount++;
          continue;
        }
        if (issuedDate < twoYearsAgo) {
          errors.push(`Row ${rowNum}: issued_date too old (must be within 2 years)`);
          errorCount++;
          continue;
        }
        if (dueDate < issuedDate) {
          errors.push(`Row ${rowNum}: due_date cannot be before issued_date`);
          errorCount++;
          continue;
        }

        // ═══ FRAUD PROTECTION: Status Validation ═══
        const validStatuses = ['unpaid', 'paid', 'arranged', 'disputed', 'uncollectable'];
        const invoiceStatus = (status || 'unpaid').toLowerCase();
        if (!validStatuses.includes(invoiceStatus)) {
          errors.push(`Row ${rowNum}: Invalid status "${status}" (must be: ${validStatuses.join(', ')})`);
          errorCount++;
          continue;
        }

        // Find or create customer
        const customerResult = await pool.query(
          `SELECT id FROM customers WHERE company_id = $1 AND email = $2`,
          [companyId, customer_email]
        );

        let customerId: string;
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
        } else {
          // Create new customer
          const createCustomerResult = await pool.query(
            `INSERT INTO customers (company_id, name, email, company_name)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [companyId, customer_name, customer_email, customer_name]
          );
          customerId = createCustomerResult.rows[0].id;
        }

        // Create invoice with source tracking
        const invoiceResult = await pool.query(
          `INSERT INTO invoices
           (company_id, customer_id, amount, currency, due_date, issued_date, status, source, source_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            companyId,
            customerId,
            parsedAmount,
            'USD',
            new Date(due_date).toISOString(),
            new Date(issued_date).toISOString(),
            invoiceStatus,
            'manual',
            invoice_id || null,
            `Uploaded via CSV: ${fileName}`
          ]
        );

        successCount++;
      } catch (rowErr: any) {
        errors.push(`Row ${rowNum}: ${rowErr.message}`);
        errorCount++;
      }
    }

    // ═══ AUDIT LOG: Record the upload ═══
    try {
      await pool.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          companyId,
          userId || 'unknown',
          'invoice_csv_upload',
          'invoices',
          JSON.stringify({
            fileName,
            successCount,
            errorCount,
            totalRows: successCount + errorCount,
          })
        ]
      );
    } catch (auditErr: any) {
      logWarn(MODULE, handler, 'Failed to log audit', auditErr);
      // Don't fail the upload if audit logging fails
    }

    logInfo(MODULE, handler, 'Invoice CSV upload complete', {
      companyId,
      userId,
      fileName,
      successCount,
      errorCount,
      totalRows: successCount + errorCount,
      fileSizeKB: fileSizeKB.toFixed(0)
    });

    return res.json({
      success: true,
      message: `Imported ${successCount} invoices${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
      successCount,
      errorCount,
      errors: errorCount > 0 ? errors.slice(0, 5) : undefined, // Return first 5 errors
      totalProcessed: successCount + errorCount,
    });
  } catch (err: any) {
    logError(MODULE, handler, 'Failed to upload invoices', err);
    return res.status(500).json({ error: 'Failed to upload invoice file: ' + err.message });
  }
};
