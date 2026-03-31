import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';

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

      let email = inv.customerEmail;
      if (!email || !email.includes('@')) {
        email = `cust${Math.random().toString(36).substring(7)}@local.invalid`;
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

      normalized.push({
        customerName: inv.customerName || email,
        customerEmail: email,
        amount: inv.amount,
        currency: inv.currency || 'USD',
        dueDate,
        issuedDate,
      });
    }

    // STEP 2: Bulk find-or-create customers (1 SQL call)
    const uniqueEmails = [...new Set(normalized.map(i => i.customerEmail))];
    const customerMap = new Map<string, string>();

    // Get existing customers
    if (uniqueEmails.length > 0) {
      const existing = await pool.query(
        `SELECT id, email FROM customers WHERE company_id = $1 AND email = ANY($2)`,
        [companyId, uniqueEmails]
      );
      existing.rows.forEach((row: any) => customerMap.set(row.email, row.id));
    }

    // Create missing customers in BULK (1 SQL call)
    const missing = uniqueEmails.filter(e => !customerMap.has(e));
    if (missing.length > 0) {
      const vals = missing.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(',');
      const params = [companyId, ...missing.flatMap(e => [e.split('@')[0], e])];

      const newCustomers = await pool.query(
        `INSERT INTO customers (company_id, name, email) VALUES ${vals} RETURNING id, email`,
        params
      );
      newCustomers.rows.forEach((row: any) => customerMap.set(row.email, row.id));
    }

    // STEP 3: OPTIMIZED batch duplicate detection using EXISTS (simple & fast)
    const toInsert: any[] = [];
    let duplicates = 0;

    // Build list of invoices to check
    const invoicesToCheck = normalized
      .map(inv => ({
        inv,
        customerId: customerMap.get(inv.customerEmail),
        amount: inv.amount,
        dueDate: inv.dueDate.toISOString().split('T')[0],
      }))
      .filter(item => item.customerId);

    // Batch duplicate detection in chunks of 50
    const BATCH_SIZE = 50;
    for (let batchStart = 0; batchStart < invoicesToCheck.length; batchStart += BATCH_SIZE) {
      const batch = invoicesToCheck.slice(batchStart, Math.min(batchStart + BATCH_SIZE, invoicesToCheck.length));

      // Fetch ALL duplicates for this batch in ONE query
      const customerIds = batch.map(item => item.customerId!);
      const amounts = batch.map(item => item.amount);
      const dueDates = batch.map(item => item.dueDate);

      try {
        const dupeResult = await pool.query(
          `SELECT customer_id, amount, due_date::date
           FROM invoices
           WHERE company_id = $1
           AND customer_id = ANY($2)
           AND amount = ANY($3)
           AND due_date::date = ANY($4)`,
          [companyId, customerIds, amounts, dueDates]
        );

        // Store as Set for O(1) lookup
        const dupeSet = new Set(dupeResult.rows.map((r: any) => `${r.customer_id}:${r.amount}:${r.due_date}`));

        // Filter batch
        batch.forEach(({ inv, customerId }) => {
          if (!customerId) {
            skipped++;
            return;
          }

          const key = `${customerId}:${inv.amount}:${inv.dueDate.toISOString().split('T')[0]}`;
          if (dupeSet.has(key)) {
            duplicates++;
            return;
          }

          toInsert.push({
            customerId,
            amount: inv.amount,
            currency: inv.currency,
            dueDate: inv.dueDate,
            issuedDate: inv.issuedDate,
          });
        });
      } catch (err: any) {
        logError(LOG_MODULE, 'processCsvImportJob', `Batch duplicate check failed at offset ${batchStart}`, err);
        throw err;
      }
    }

    // STEP 4: BULK INSERT all invoices at once (1 SQL call)
    let created = 0;
    if (toInsert.length > 0) {
      const vals = toInsert.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(',');
      const params: any[] = [];

      toInsert.forEach(inv => {
        params.push(
          inv.customerId,
          inv.amount,
          inv.currency,
          inv.dueDate,
          inv.issuedDate,
          companyId,
          'manual'
        );
      });

      const result = await pool.query(
        `INSERT INTO invoices (customer_id, amount, currency, due_date, issued_date, company_id, source, status)
         VALUES ${vals} RETURNING id`,
        params
      );

      created = result.rows.length;
    }

    const elapsed = Date.now() - startTime;
    logInfo(LOG_MODULE, 'processCsvImportJob', `Done in ${elapsed}ms`, { created, duplicates, skipped });

    jobResults.set(jobId, { status: 'done', created, skipped, duplicates, total: invoices.length });
    setTimeout(() => jobResults.delete(jobId), 10 * 60 * 1000);
  } catch (err: any) {
    logError(LOG_MODULE, 'processCsvImportJob', 'Failed', err);
    jobResults.set(jobId, { status: 'error', created: 0, skipped: 0, duplicates: 0, total: invoices.length, error: err.message });
  }
}

// CSV Import Worker (only used when Redis is available)
let csvImportWorkerInstance: Worker<CSVImportJobData> | null = null;

try {
  csvImportWorkerInstance = new Worker<CSVImportJobData>(
    'csv-import',
    async (job) => {
      const { companyId, invoices, jobId } = job.data;
      // Delegate to shared processing function
      await processCsvImportJob(companyId, invoices, jobId);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1, // Process one CSV at a time
    }
  );
} catch (err: any) {
  logError(LOG_MODULE, 'workerInit', 'Failed to initialize CSV worker (Redis unavailable)', err);
  csvImportWorkerInstance = null;
}

export const csvImportWorker = csvImportWorkerInstance;

if (csvImportWorker) {
  csvImportWorker.on('completed', (job) => {
    logInfo(LOG_MODULE, 'worker', 'Job completed', { jobId: job.data.jobId });
  });

  csvImportWorker.on('failed', (job, err) => {
    logError(LOG_MODULE, 'worker', 'Job failed', err, { jobId: job?.data.jobId });
  });
}
