import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { logInfo, logError, logWarn } from '../utils/logger';
import { pool } from '../config/database';
import { scoreCustomerRiskFromDaysOverdue, scoreCustomerRisk } from '../services/riskScoringService';
import crypto from 'crypto';

const LOG_MODULE = 'csvImportJob';

// Generate deterministic source_id for CSV invoices
function generateCSVInvoiceId(customerId: string, amount: number, dueDate: Date, issuedDate: Date): string {
  const content = `${customerId}|${amount}|${dueDate.toISOString()}|${issuedDate.toISOString()}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

export interface CSVImportJobData {
  companyId: string;
  invoices: Array<{
    customerName: string;
    customerEmail: string;
    amount: number;
    currency: string;
    dueDate: string;
    issuedDate?: string;
    phone?: string;
  }>;
  jobId: string;
}

let csvImportQueue: Queue<CSVImportJobData> | null = null;
let redisAvailable = true;

export function getCSVImportQueue(): Queue<CSVImportJobData> | null {
  if (!csvImportQueue && redisAvailable) {
    try {
      csvImportQueue = new Queue<CSVImportJobData>('csv-import', {
        connection: getRedisConnection(),
      });
    } catch (err: any) {
      logError(LOG_MODULE, 'getCSVImportQueue', 'Redis not available', err);
      redisAvailable = false;
      return null;
    }
  }
  return csvImportQueue;
}

// Store job results - keep for 10 minutes
const jobResults = new Map<string, { status: 'processing' | 'done' | 'error'; created: number; skipped: number; duplicates: number; total: number; error?: string }>();

export function getCSVImportStatus(jobId: string) {
  return jobResults.get(jobId);
}

// Parse flexible dates
const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr || dateStr.trim() === '') return null;
  const cleaned = dateStr.replace(/\.0+$/, '');
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  if (/^\d{8}$/.test(cleaned)) {
    const yyyy = cleaned.substring(0, 4);
    const mm = cleaned.substring(4, 6);
    const dd = cleaned.substring(6, 8);
    d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// OPTIMIZED BULK INSERT - Single SQL call, max parallelism
export async function processCsvImportJob(companyId: string, invoices: CSVImportJobData['invoices'], jobId: string): Promise<void> {
  const startTime = Date.now();

  logInfo(LOG_MODULE, 'processCsvImportJob', `Starting import`, { jobId, invoiceCount: invoices.length });

  jobResults.set(jobId, { status: 'processing', created: 0, skipped: 0, duplicates: 0, total: invoices.length });

  try {
    let skipped = 0;

    // STEP 1: Normalize & validate all invoices IN MEMORY (no DB calls)
    const normalized: Array<{
      customerName: string;
      customerEmail: string;
      amount: number;
      currency: string;
      dueDate: Date;
      issuedDate: Date;
      phone?: string;
    }> = [];

    for (const inv of invoices) {
      // Validate amount
      if (!inv.amount || inv.amount <= 0) {
        skipped++;
        continue;
      }

      // Validate email (REQUIRED for dunning) - MVP: email is mandatory for RecoverAI
      const email = (inv.customerEmail || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        skipped++;
        logWarn(LOG_MODULE, 'processCsvImportJob', 'CSV row skipped: missing or invalid email', {
          customerName: inv.customerName,
          email: inv.customerEmail,
          reason: 'Email is required for dunning campaigns (email + SMS)',
        });
        continue;
      }

      // Validate customer name
      if (!inv.customerName || typeof inv.customerName !== 'string' || inv.customerName.trim().length === 0) {
        skipped++;
        logWarn(LOG_MODULE, 'processCsvImportJob', 'CSV row skipped: missing customer name', {
          email,
          reason: 'Company name is required',
        });
        continue;
      }

      let dueDate = parseFlexibleDate(inv.dueDate);
      if (!dueDate) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
      }

      let issuedDate = parseFlexibleDate(inv.issuedDate);
      if (!issuedDate) {
        issuedDate = new Date();
      }

      const phone = (inv.phone || '').trim();

      normalized.push({
        customerName: inv.customerName.trim(),
        customerEmail: email,  // Already validated: present, contains @, trimmed, lowercased
        amount: inv.amount,
        currency: (inv.currency || 'USD').toUpperCase(),
        dueDate,
        issuedDate,
        phone,
      });
    }

    // STEP 2: Bulk find-or-create customers — email is the unique identifier
    // Each unique email = one customer record. Company name is a display label only.

    // email → customer_id map (built from DB lookups)
    const customerByEmailMap = new Map<string, string>();

    // email → first invoice data (for creating new customers)
    const emailToFirstInvoice = new Map<string, typeof normalized[0]>();
    for (const inv of normalized) {
      if (!emailToFirstInvoice.has(inv.customerEmail)) {
        emailToFirstInvoice.set(inv.customerEmail, inv);
      }
    }

    const uniqueEmails = [...emailToFirstInvoice.keys()];

    // Find existing customers by email (bulk — 1 SQL call)
    if (uniqueEmails.length > 0) {
      const existing = await pool.query(
        `SELECT id, email FROM customers WHERE company_id = $1 AND LOWER(email) = ANY($2)`,
        [companyId, uniqueEmails.map(e => e.toLowerCase())]
      );
      existing.rows.forEach((row: any) => {
        customerByEmailMap.set(row.email.toLowerCase(), row.id);
      });
    }

    // Create new customers for emails not yet in DB (bulk — 1 SQL call)
    const missingEmails = uniqueEmails.filter(e => !customerByEmailMap.has(e.toLowerCase()));
    if (missingEmails.length > 0) {
      // 4 cols per row: company_id, email, company_name, phone
      const vals = missingEmails.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(',');
      const params = [companyId, ...missingEmails.flatMap(email => {
        const inv = emailToFirstInvoice.get(email)!;
        return [email, inv.customerName, inv.phone || null];
      })];

      const newCustomers = await pool.query(
        `INSERT INTO customers (company_id, email, company_name, phone)
         VALUES ${vals}
         ON CONFLICT (company_id, (LOWER(email))) DO NOTHING
         RETURNING id, email`,
        params
      );
      newCustomers.rows.forEach((row: any) => {
        customerByEmailMap.set(row.email.toLowerCase(), row.id);
      });
    }

    // STEP 3: Check duplicates - simple loop, one query per invoice (proven to work)
    const toInsert: any[] = [];
    let duplicates = 0;

    for (const inv of normalized) {
      const customerId = customerByEmailMap.get(inv.customerEmail.toLowerCase());

      if (!customerId) {
        skipped++;
        continue;
      }

      // Quick duplicate check: same customer + amount + due date
      const isDupe = await pool.query(
        `SELECT 1 FROM invoices WHERE company_id = $1 AND customer_id = $2 AND amount = $3 AND due_date::date = $4::date LIMIT 1`,
        [companyId, customerId, inv.amount, inv.dueDate.toISOString().split('T')[0]]
      );

      if (isDupe.rows.length > 0) {
        duplicates++;
        continue;
      }

      toInsert.push({
        customerId,
        amount: inv.amount,
        currency: inv.currency,
        dueDate: inv.dueDate,
        issuedDate: inv.issuedDate,
      });
    }

    // STEP 4: BULK INSERT all invoices at once (1 SQL call)
    let created = 0;
    if (toInsert.length > 0) {
      // 9 columns per row: customer_id, amount, currency, due_date, issued_date, company_id, source, source_id, status
      const vals = toInsert.map((_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`).join(',');
      const params: any[] = [];

      toInsert.forEach(inv => {
        const csvInvoiceId = generateCSVInvoiceId(inv.customerId, inv.amount, inv.dueDate, inv.issuedDate);
        params.push(
          inv.customerId,      // $1, $10, $19...
          inv.amount,          // $2, $11, $20...
          inv.currency,        // $3, $12, $21...
          inv.dueDate,         // $4, $13, $22...
          inv.issuedDate,      // $5, $14, $23...
          companyId,           // $6, $15, $24...
          'csv',               // $7, $16, $25... (source) - changed from 'manual' to 'csv'
          csvInvoiceId,        // $8, $17, $26... (source_id) - NEW!
          'unpaid'             // $9, $18, $27... (status)
        );
      });

      const result = await pool.query(
        `INSERT INTO invoices (customer_id, amount, currency, due_date, issued_date, company_id, source, source_id, status)
         VALUES ${vals}
         ON CONFLICT (company_id, source, source_id) DO UPDATE SET updated_at = NOW()
         RETURNING id, customer_id`,
        params
      );

      created = result.rows.length;

      // Calculate and update customer risk_score based on days overdue (MVP: no payment behavior yet)
      const uniqueCustomerIds = [...new Set(result.rows.map((r: any) => r.customer_id))];

      for (const customerId of uniqueCustomerIds) {
        try {
          // Get max days overdue for this customer from the newly imported invoices
          const overdueResult = await pool.query(
            `SELECT MAX(CEIL(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400)::INT) AS max_days_overdue
             FROM invoices i
             WHERE i.customer_id = $1 AND i.company_id = $2 AND i.status = 'unpaid' AND i.due_date < NOW()`,
            [customerId, companyId]
          );

          const maxDaysOverdue = overdueResult.rows[0]?.max_days_overdue || 0;
          const score = scoreCustomerRiskFromDaysOverdue(maxDaysOverdue);

          // Update customer's overall risk score
          await pool.query(
            `UPDATE customers
             SET customer_risk_score = $1, customer_risk_score_updated_at = NOW()
             WHERE id = $2 AND company_id = $3`,
            [score, customerId, companyId]
          );

          logInfo(LOG_MODULE, 'processCsvImportJob', 'Updated customer risk score (CSV import)', {
            customerId,
            maxDaysOverdue,
            score,
          });

          // ✅ FIX: Call full scoreCustomerRisk() to populate payment_insights JSONB
          try {
            const { score: fullScore } = await scoreCustomerRisk(companyId, customerId);
            logInfo(LOG_MODULE, 'processCsvImportJob', 'Full risk assessment + payment_insights populated', {
              customerId,
              riskScore: fullScore,
            });
          } catch (richErr) {
            logError(LOG_MODULE, 'processCsvImportJob', 'Full risk scoring failed (non-blocking)', richErr, { customerId });
            // Non-blocking — payment_insights will be populated on next Stripe sync
          }
        } catch (err) {
          logError(LOG_MODULE, 'processCsvImportJob', 'Failed to calculate customer risk score', err, {
            customerId,
          });
          // Non-blocking — continue with next customer
        }
      }
    }

    const elapsed = Date.now() - startTime;
    logInfo(LOG_MODULE, 'processCsvImportJob', `Done in ${elapsed}ms`, { created, duplicates, skipped });

    jobResults.set(jobId, { status: 'done', created, skipped, duplicates, total: invoices.length });

    // Trigger billing anomaly scan after import (non-blocking)
    try {
      const { runBillingOptimization } = await import('../services/billingOptimizationService');
      await runBillingOptimization(companyId);
      logInfo(LOG_MODULE, 'processCsvImportJob', 'Billing anomaly scan complete post-import');
    } catch (err) {
      logError(LOG_MODULE, 'processCsvImportJob', 'Billing optimization scan failed (non-critical)', err);
    }

    // Build per-client behavioral insights from historical data (non-blocking)
    try {
      const { buildClientInsights } = await import('../services/clientInsightsService');
      await buildClientInsights(companyId);
      logInfo(LOG_MODULE, 'processCsvImportJob', 'Client insights built post-import');
    } catch (err) {
      logError(LOG_MODULE, 'processCsvImportJob', 'Client insights build failed (non-critical)', err);
    }

    setTimeout(() => jobResults.delete(jobId), 10 * 60 * 1000);
  } catch (err: any) {
    logError(LOG_MODULE, 'processCsvImportJob', 'Failed', err);
    jobResults.set(jobId, { status: 'error', created: 0, skipped: 0, duplicates: 0, total: invoices.length, error: err.message });
  }
}

// CSV Import Worker (only used when Redis is available)
let csvImportWorkerInstance: Worker<CSVImportJobData> | null = null;
let lastJobCompletedAt: number = 0;
let workerCleanupTimer: NodeJS.Timeout | null = null;
const WORKER_IDLE_TIMEOUT_MS = 60000; // Close worker if idle for 1 minute

// ============================================================
// CSV Import Worker: LAZY START + AUTO-CLOSE (Zero idle polling)
// ============================================================
// Strategy: Don't create worker on startup. Create ONLY when:
// 1. First CSV upload request → worker starts
// 2. Job completes → set idle timeout
// 3. If no new jobs for 60s → close worker
// Result: ZERO Redis BZPOPMIN polling when idle
// ============================================================

/**
 * Schedule worker cleanup after idle timeout
 */
function scheduleWorkerCleanup(): void {
  // Clear existing timer
  if (workerCleanupTimer) {
    clearTimeout(workerCleanupTimer);
  }

  workerCleanupTimer = setTimeout(async () => {
    if (csvImportWorkerInstance) {
      try {
        await csvImportWorkerInstance.close();
        csvImportWorkerInstance = null;
        logInfo(LOG_MODULE, 'scheduleWorkerCleanup', 'CSV worker closed after idle timeout');
      } catch (err: any) {
        logError(LOG_MODULE, 'scheduleWorkerCleanup', 'Failed to close worker', err);
      }
    }
  }, WORKER_IDLE_TIMEOUT_MS);
}

/**
 * Lazy-create worker on first job arrival
 * Worker auto-closes after 60s of inactivity
 */
export function initializeWorkerOnDemand(): void {
  if (csvImportWorkerInstance) {
    // Worker already running, cancel cleanup timer since we're submitting a job
    if (workerCleanupTimer) {
      clearTimeout(workerCleanupTimer);
      workerCleanupTimer = null;
    }
    return;
  }
  if (!redisAvailable) return; // Redis unavailable

  try {
    csvImportWorkerInstance = new Worker<CSVImportJobData>(
      'csv-import',
      async (job) => {
        const { companyId, invoices, jobId } = job.data;
        await processCsvImportJob(companyId, invoices, jobId);
      },
      {
        connection: getRedisConnection(),
        concurrency: 1,               // Process one CSV at a time
        // Event-driven only: BZPOPMIN blocking, never poll
        tryBlockedFetch: true,        // Use BZPOPMIN (blocking) — blocks until job arrives
        maxStalCount: 2,              // Switch to blocking mode immediately
        stalledInterval: 600000,      // Check for stalled jobs every 10 min
        drainDelay: 300,              // Wait 5 minutes before giving up on blocking
      } as any
    );

    csvImportWorkerInstance.on('completed', async (job) => {
      logInfo(LOG_MODULE, 'worker', 'Job completed', { jobId: job.data.jobId });
      lastJobCompletedAt = Date.now();
      // Close worker immediately after job completes to stop polling
      try {
        if (csvImportWorkerInstance) {
          await csvImportWorkerInstance.close();
          csvImportWorkerInstance = null;
          logInfo(LOG_MODULE, 'worker', 'CSV worker closed immediately after job completion');
        }
      } catch (err: any) {
        logError(LOG_MODULE, 'worker', 'Failed to close worker after completion', err);
      }
    });

    csvImportWorkerInstance.on('failed', async (job, err) => {
      logError(LOG_MODULE, 'worker', 'Job failed', err, { jobId: job?.data.jobId });
      lastJobCompletedAt = Date.now();
      // Close worker immediately after job fails to stop polling
      try {
        if (csvImportWorkerInstance) {
          await csvImportWorkerInstance.close();
          csvImportWorkerInstance = null;
          logInfo(LOG_MODULE, 'worker', 'CSV worker closed immediately after job failure');
        }
      } catch (err: any) {
        logError(LOG_MODULE, 'worker', 'Failed to close worker after failure', err);
      }
    });

    logInfo(LOG_MODULE, 'initializeWorkerOnDemand', 'CSV worker initialized (lazy)', {
      concurrency: 1,
      polling: 'event-driven only',
      idleTimeout: `${WORKER_IDLE_TIMEOUT_MS / 1000}s`,
    });

    // Schedule cleanup after job completes
    scheduleWorkerCleanup();
  } catch (err: any) {
    logError(LOG_MODULE, 'initializeWorkerOnDemand', 'Failed to init worker', err);
    redisAvailable = false;
  }
}

// DO NOT export csvImportWorker at module level
// Worker only created on-demand via initializeWorkerOnDemand()
// Worker auto-closes after idle timeout to prevent BZPOPMIN polling
