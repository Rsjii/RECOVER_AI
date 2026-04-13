import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';
import { scoreCustomerRiskFromDaysOverdue } from '../services/riskScoringService';

const LOG_MODULE = 'csvImportJob';

export interface CSVImportJobData {
  companyId: string;
  invoices: Array<{
    customerName: string;
    customerEmail: string;
    amount: number;
    currency: string;
    dueDate: string;
    issuedDate?: string;
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
    }> = [];

    for (const inv of invoices) {
      if (!inv.amount || inv.amount <= 0) {
        skipped++;
        continue;
      }

      // Keep email as-is (empty or with value) - don't auto-generate
      let email = inv.customerEmail || '';

      let dueDate = parseFlexibleDate(inv.dueDate);
      if (!dueDate) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
      }

      let issuedDate = parseFlexibleDate(inv.issuedDate);
      if (!issuedDate) {
        issuedDate = new Date();
      }

      normalized.push({
        customerName: inv.customerName,
        customerEmail: email,
        amount: inv.amount,
        currency: inv.currency || 'USD',
        dueDate,
        issuedDate,
      });
    }

    // STEP 2: Bulk find-or-create customers (1 SQL call)
    const uniqueEmails = [...new Set(normalized.map(i => i.customerEmail).filter(e => e))]; // Only non-empty emails
    const uniqueNames = [...new Set(normalized.map(i => i.customerName).filter(n => n))]; // For matching by name
    const customerMap = new Map<string, string>(); // email -> id map
    const customerByNameMap = new Map<string, string>(); // name -> id map for empty email invoices

    // Get existing customers by email
    if (uniqueEmails.length > 0) {
      const existing = await pool.query(
        `SELECT id, email, name FROM customers WHERE company_id = $1 AND email = ANY($2)`,
        [companyId, uniqueEmails]
      );
      existing.rows.forEach((row: any) => {
        customerMap.set(row.email, row.id);
        customerByNameMap.set(row.name, row.id); // Also store by name
      });
    }

    // Get existing customers by name (for invoices with empty email)
    if (uniqueNames.length > 0) {
      const existing = await pool.query(
        `SELECT id, name FROM customers WHERE company_id = $1 AND name = ANY($2)`,
        [companyId, uniqueNames]
      );
      existing.rows.forEach((row: any) => {
        customerByNameMap.set(row.name, row.id);
      });
    }

    // Create missing customers in BULK
    // For emails: create only if not in customerMap
    // For names: create only if not in customerByNameMap AND no email exists for that name
    const missingEmails = uniqueEmails.filter(e => !customerMap.has(e));
    const missingNames = uniqueNames.filter(n => !customerByNameMap.has(n));

    const newCustomersToCreate: Array<{ name: string; email: string | null }> = [];

    // Add missing emails
    missingEmails.forEach(email => {
      newCustomersToCreate.push({
        name: email.split('@')[0],
        email: email
      });
    });

    // Add missing names (without email)
    // Store as NULL for customers without email - PostgreSQL allows multiple NULLs in UNIQUE constraint
    missingNames.forEach(name => {
      const hasEmailVersion = uniqueEmails.some(e => e.split('@')[0] === name);
      if (!hasEmailVersion) {
        newCustomersToCreate.push({
          name: name,
          email: null
        });
      }
    });

    // Bulk insert all missing customers
    if (newCustomersToCreate.length > 0) {
      const vals = newCustomersToCreate.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(',');
      const params = [companyId, ...newCustomersToCreate.flatMap(c => [c.name, c.email])];

      const newCustomers = await pool.query(
        `INSERT INTO customers (company_id, name, email) VALUES ${vals} RETURNING id, email, name`,
        params
      );
      newCustomers.rows.forEach((row: any) => {
        if (row.email) {
          customerMap.set(row.email, row.id);
        }
        customerByNameMap.set(row.name, row.id);
      });
    }

    // STEP 3: Check duplicates - simple loop, one query per invoice (proven to work)
    const toInsert: any[] = [];
    let duplicates = 0;

    for (const inv of normalized) {
      // Get customer ID: try email first, then name
      let customerId = inv.customerEmail ? customerMap.get(inv.customerEmail) : undefined;
      if (!customerId) {
        customerId = customerByNameMap.get(inv.customerName);
      }

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
      // 8 columns per row: customer_id, amount, currency, due_date, issued_date, company_id, source, status
      const vals = toInsert.map((_, i) => `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`).join(',');
      const params: any[] = [];

      toInsert.forEach(inv => {
        params.push(
          inv.customerId,      // $1, $9, $17...
          inv.amount,          // $2, $10, $18...
          inv.currency,        // $3, $11, $19...
          inv.dueDate,         // $4, $12, $20...
          inv.issuedDate,      // $5, $13, $21...
          companyId,           // $6, $14, $22...
          'manual',            // $7, $15, $23... (source)
          'unpaid'             // $8, $16, $24... (status)
        );
      });

      const result = await pool.query(
        `INSERT INTO invoices (customer_id, amount, currency, due_date, issued_date, company_id, source, status)
         VALUES ${vals} RETURNING id, customer_id`,
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
