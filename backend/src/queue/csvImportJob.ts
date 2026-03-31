import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { logInfo, logError } from '../utils/logger';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';

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
      logError(LOG_MODULE, 'getCSVImportQueue', 'Redis not available, CSV processing will be synchronous', err);
      redisAvailable = false;
      return null;
    }
  }
  return csvImportQueue;
}

// Store job results in memory (in production, use Redis)
const jobResults = new Map<string, { status: 'processing' | 'done' | 'error'; created: number; skipped: number; duplicates: number; total: number; error?: string }>();

export function getCSVImportStatus(jobId: string) {
  return jobResults.get(jobId);
}

// Exported function for synchronous processing (used in dev mode when Redis is unavailable)
export async function processCsvImportJob(companyId: string, invoices: CSVImportJobData['invoices'], jobId: string): Promise<void> {
  const startTime = Date.now();

  logInfo(LOG_MODULE, 'processCsvImportJob', 'Processing CSV import (sync mode)', { jobId, companyId, invoiceCount: invoices.length });

  if (invoices.length > 0) {
    logInfo(LOG_MODULE, 'processCsvImportJob', 'First invoice sample', invoices[0]);
  }

  jobResults.set(jobId, { status: 'processing', created: 0, skipped: 0, duplicates: 0, total: invoices.length });

  try {
    let created = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const inv of invoices) {
      try {
        // Validate - if amount is still 0 after parsing, mark as skipped
        if (inv.amount <= 0) {
          skipped++;
          continue;
        }

        if (!inv.customerEmail || !inv.customerEmail.includes('@')) {
          const fakeEmail = `customer${Math.random().toString(36).substring(7)}@local.invalid`;
          inv.customerEmail = fakeEmail;
        }

        // Parse dates - handle multiple formats (YYYY-MM-DD, YYYYMMDD, YYYY-MM-DD HH:MM:SS, etc)
        const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
          if (!dateStr || dateStr.trim() === '') return null;

          // Remove decimals (e.g., "20200210.0" -> "20200210")
          const cleaned = dateStr.replace(/\.0+$/, '');

          // Try parsing as ISO (YYYY-MM-DD)
          let d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;

          // Try YYYYMMDD format
          if (/^\d{8}$/.test(cleaned)) {
            const yyyy = cleaned.substring(0, 4);
            const mm = cleaned.substring(4, 6);
            const dd = cleaned.substring(6, 8);
            d = new Date(`${yyyy}-${mm}-${dd}`);
            if (!isNaN(d.getTime())) return d;
          }

          return null;
        };

        let dueDate = parseFlexibleDate(inv.dueDate);
        if (!dueDate || isNaN(dueDate.getTime())) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);
        }

        let issuedDate = parseFlexibleDate(inv.issuedDate);
        if (!issuedDate || isNaN(issuedDate.getTime())) {
          issuedDate = new Date();
        }

        // Find or create customer
        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: inv.customerName || inv.customerEmail,
          email: inv.customerEmail,
        });

        // Check for duplicate: customer_id + amount + due_date
        // Uses optimized DB query instead of fetching all customer invoices
        const isDuplicate = await InvoiceDB.checkDuplicateInvoice(
          companyId,
          customer.id,
          inv.amount,
          dueDate
        );

        if (isDuplicate) {
          duplicates++;
          continue; // Skip this row
        }

        // Create invoice
        await InvoiceDB.createManualInvoice({
          companyId,
          customerId: customer.id,
          amount: inv.amount,
          currency: inv.currency || 'USD',
          dueDate,
          issuedDate,
          source: 'manual',
        });

        created++;
      } catch (err: any) {
        skipped++;
        logError(LOG_MODULE, 'rowProcessing', 'Row processing failed', err);
      }
    }

    const elapsed = Date.now() - startTime;
    logInfo(LOG_MODULE, 'processCsvImportJob', `CSV import complete in ${elapsed}ms`, { jobId, created, skipped, duplicates });

    jobResults.set(jobId, { status: 'done', created, skipped, total: invoices.length, duplicates });
  } catch (err: any) {
    logError(LOG_MODULE, 'processCsvImportJob', `CSV import failed in ${Date.now() - startTime}ms`, err);
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
