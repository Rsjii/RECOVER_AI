import { Request, Response } from 'express';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'customerController';

/**
 * POST /api/customers
 * Create a new customer
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createCustomer';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    const { company_name, email, phone, phone_opt_in } = req.body as {
      company_name?: string;
      email?: string;
      phone?: string;
      phone_opt_in?: boolean;
    };

    // Validate required fields
    const errors = [];
    if (!company_name || typeof company_name !== 'string' || company_name.trim().length === 0) errors.push('company_name');
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email (valid email required)');

    if (errors.length > 0) {
      sendErrorResponse(res, 400, `Missing or invalid: ${errors.join(', ')}`);
      return;
    }

    // Create customer (company_name and email are guaranteed to exist after validation)
    const customer = await CustomerDB.findOrCreateCustomer({
      companyId,
      companyName: (company_name as string).trim(),
      email: (email as string).trim().toLowerCase(),
    });

    // Update phone if provided
    if (phone) {
      await CustomerDB.updateCustomerPhone(customer.id, companyId, phone.trim(), phone_opt_in ?? false);
    }

    logInfo(LOG_MODULE, handler, `Customer created in ${Date.now() - startTime}ms`, { customerId: customer.id });

    res.status(201).json({
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `Failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listCustomers';
  const companyId = (req as any).companyId;

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const riskTier = req.query.riskTier as string | undefined;

    const { data, total } = await CustomerDB.listCustomers(companyId, limit, offset, riskTier);

    res.status(200).json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to list customers', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getAllCustomerIds = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAllCustomerIds';
  const companyId = (req as any).companyId;

  try {
    const riskTier = req.query.riskTier as string | undefined;

    let query = 'SELECT id FROM customers WHERE company_id = $1';
    const params: any[] = [companyId];

    if (riskTier) {
      if (riskTier === 'none') {
        query += ' AND (max_risk_score IS NULL OR max_risk_score = 0)';
      } else if (riskTier === 'low') {
        query += ' AND max_risk_score > 0 AND max_risk_score <= 30';
      } else if (riskTier === 'medium') {
        query += ' AND max_risk_score > 30 AND max_risk_score <= 60';
      } else if (riskTier === 'high') {
        query += ' AND max_risk_score > 60';
      }
    }

    const result = await pool.query(query, params);
    const customerIds = result.rows.map((r: any) => r.id);

    logInfo(LOG_MODULE, handler, `Fetched ${customerIds.length} customer IDs`, { companyId, riskTier });

    res.status(200).json({
      customerIds,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch all customer IDs', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCustomer';
  const companyId = (req as any).companyId;

  try {
    const id = req.params.id as string;

    const customer = await CustomerDB.findCustomerById(id, companyId);
    if (!customer) {
      sendErrorResponse(res, 404, 'Customer not found');
      return;
    }

    // 5 parallel queries for customer health dashboard
    const [
      invoiceResult,
      emailLogsResult,
      arHealthResult,
      riskFactorsResult,
      agentActivityResult,
      paymentTimelineResult,
      activeInvoicesResult,
    ] = await Promise.all([
      // 1. All invoices (for backwards compat)
      InvoiceDB.listInvoices(companyId, { customerId: id as string }, 100, 0),
      // 2. Email logs
      pool.query(
        `SELECT el.*, i.due_date, i.amount, i.currency
         FROM email_logs el
         JOIN invoices i ON el.invoice_id = i.id
         WHERE el.company_id = $1 AND i.customer_id = $2
         ORDER BY el.sent_at DESC
         LIMIT 100`,
        [companyId, id]
      ),
      // 3. AR Health: total, overdue, breakdown
      pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount::numeric ELSE 0 END), 0) as total_ar,
          COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 30 THEN amount::numeric ELSE 0 END), 0) as overdue_ar,
          COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 30 AND EXTRACT(DAY FROM NOW() - due_date) < 60 THEN amount::numeric ELSE 0 END), 0) as days_30,
          COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 60 AND EXTRACT(DAY FROM NOW() - due_date) < 90 THEN amount::numeric ELSE 0 END), 0) as days_60,
          COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 90 THEN amount::numeric ELSE 0 END), 0) as days_90,
          COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(*) as total_count
         FROM invoices
         WHERE customer_id = $1 AND company_id = $2`,
        [id, companyId]
      ),
      // 4. Risk factors: bounce count, overdue count
      pool.query(
        `SELECT
          COUNT(CASE WHEN i.status = 'unpaid' AND EXTRACT(DAY FROM NOW() - i.due_date) >= 30 THEN 1 END) as overdue_30_count,
          COUNT(CASE WHEN el.status = 'bounced' THEN 1 END) as bounce_count
         FROM invoices i
         LEFT JOIN email_logs el ON i.id = el.invoice_id AND el.company_id = $2
         WHERE i.customer_id = $1 AND i.company_id = $2`,
        [id, companyId]
      ),
      // 5. Agent activity: emails/SMS sent in last 30 days
      pool.query(
        `SELECT
          COUNT(CASE WHEN source = 'email' THEN 1 END) as emails_sent_30d,
          COUNT(CASE WHEN source = 'email' AND opened_at IS NOT NULL THEN 1 END) as emails_opened,
          COUNT(CASE WHEN source = 'email' AND status = 'bounced' THEN 1 END) as emails_bounced,
          COUNT(CASE WHEN source = 'sms' THEN 1 END) as sms_sent_30d,
          COUNT(CASE WHEN source = 'sms' AND status = 'delivered' THEN 1 END) as sms_delivered,
          MAX(last_action_at) as last_action_at,
          (ARRAY_AGG(DISTINCT source ORDER BY source) FILTER (WHERE source IS NOT NULL))[1] as last_action_type
         FROM (
          SELECT 'email' as source, sent_at as last_action_at, opened_at, status FROM email_logs WHERE company_id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2) AND sent_at >= NOW() - INTERVAL '30 days'
          UNION ALL
          SELECT 'sms', sent_at, delivered_at, status FROM sms_logs WHERE company_id = $1 AND customer_id = $2 AND sent_at >= NOW() - INTERVAL '30 days'
         ) all_activity`,
        [companyId, id]
      ),
      // 6. Payment timeline: last 6 months
      pool.query(
        `SELECT
          DATE(p.paid_at) as payment_date,
          SUM(p.amount::numeric) as amount,
          ROUND(AVG(EXTRACT(DAY FROM (p.paid_at - i.due_date)))::numeric, 0) as avg_days_late
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.customer_id = $1 AND i.company_id = $2 AND p.paid_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE(p.paid_at)
         ORDER BY DATE(p.paid_at) DESC`,
        [id, companyId]
      ),
      // 7. Active invoices: unpaid only
      pool.query(
        `SELECT * FROM invoices
         WHERE customer_id = $1 AND company_id = $2 AND status = 'unpaid'
         ORDER BY EXTRACT(DAY FROM NOW() - due_date) DESC`,
        [id, companyId]
      ),
    ]);

    // Calculate stats from actual fetched data
    const unpaidInvoices = invoiceResult.data.filter(inv => inv.status === 'unpaid');
    const totalUnpaidAR = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    const onTimeRate = customer.payment_history?.on_time_rate || 0;
    const avgDaysLate = customer.payment_history?.avg_days_late || 0;

    const stats = {
      totalInvoices: invoiceResult.data.length,
      unpaidAR: totalUnpaidAR,
      onTimeRate: Math.round(onTimeRate),
      avgDaysLate: Math.round(avgDaysLate),
      riskScore: customer.customer_risk_score || 0,
    };

    // Build AR Health object
    const arHealthRow = arHealthResult.rows[0];
    const totalPaymentCount = arHealthRow.paid_count + arHealthRow.unpaid_count;
    const arHealth = {
      totalAR: parseFloat(arHealthRow.total_ar) || 0,
      overdueAR: parseFloat(arHealthRow.overdue_ar) || 0,
      overdueBreakdown: {
        days_30: parseFloat(arHealthRow.days_30) || 0,
        days_60: parseFloat(arHealthRow.days_60) || 0,
        days_90: parseFloat(arHealthRow.days_90) || 0,
      },
      invoiceCount: arHealthRow.unpaid_count || 0,
      paymentRate: totalPaymentCount > 0 ? Math.round((arHealthRow.paid_count / totalPaymentCount) * 100) : 0,
    };

    // Build payment insights
    const paymentInsights = {
      avgDaysToPay: Math.round(avgDaysLate) || 0,
      dsoCurrent: Math.round(avgDaysLate) || 0,
      dsoPrevious: Math.round(avgDaysLate) || 0, // Will be enhanced with historical comparison
      dsoTrend: 'stable' as const,
      reliabilityPct: customer.payment_history?.reliability_pct || 85,
    };

    // Build risk factors array
    const riskFactorsRow = riskFactorsResult.rows[0];
    const riskFactorsArray: Array<{ icon: string; reason: string; severity: 'high' | 'medium' | 'low' }> = [];

    if (riskFactorsRow.overdue_30_count > 0) {
      riskFactorsArray.push({
        icon: '🔴',
        reason: `${riskFactorsRow.overdue_30_count} invoice(s) overdue 30+ days`,
        severity: 'high',
      });
    }
    if (riskFactorsRow.bounce_count > 0) {
      riskFactorsArray.push({
        icon: '🟡',
        reason: `Email bounce rate: ${riskFactorsRow.bounce_count} bounced`,
        severity: 'medium',
      });
    }
    if (riskFactorsRow.current_dso > 25) {
      riskFactorsArray.push({
        icon: '🟡',
        reason: `Slow payment: ${Math.round(riskFactorsRow.current_dso)} days average`,
        severity: 'medium',
      });
    }
    if (riskFactorsArray.length === 0) {
      riskFactorsArray.push({
        icon: '🟢',
        reason: 'No recent risk factors',
        severity: 'low',
      });
    }

    // Build risk trend
    const riskTrend = {
      current: customer.customer_risk_score || 0,
      previous: customer.customer_risk_score || 0,
      direction: 'stable' as const,
      points: 0,
    };

    // Build communication health
    const emailBounceRate = emailLogsResult.rows.length > 0
      ? Math.round(
          (emailLogsResult.rows.filter((el: any) => el.status === 'bounced').length /
            emailLogsResult.rows.length) *
            100
        )
      : 0;

    const lastEmailRow = emailLogsResult.rows[0];
    const lastSmsRow = emailLogsResult.rows[0]; // Placeholder, would be from SMS logs

    const communicationHealth = {
      emailStatus: emailBounceRate > 20 ? 'bouncing' : emailLogsResult.rows.length > 0 ? 'working' : 'unknown',
      emailBounceRate,
      smsOptedIn: customer.phone ? true : false,
      phone: customer.phone || null,
      lastEmailDate: lastEmailRow?.sent_at || null,
      lastSmsDate: null, // Would be populated from SMS logs
      canReach: emailBounceRate <= 20 || !!customer.phone,
    };

    // Build payment timeline
    const paymentTimeline = paymentTimelineResult.rows.map((row: any) => ({
      date: row.payment_date,
      amount: parseFloat(row.amount) || 0,
      daysLate: parseInt(row.avg_days_late) || 0,
    }));

    // Build agent activity
    const agentActivityRow = agentActivityResult.rows[0];
    const agentActivity = {
      emailsSent30d: agentActivityRow.emails_sent_30d || 0,
      emailsOpened: agentActivityRow.emails_opened || 0,
      emailsBounced: agentActivityRow.emails_bounced || 0,
      smsSent30d: agentActivityRow.sms_sent_30d || 0,
      smsDelivered: agentActivityRow.sms_delivered || 0,
      lastActionDate: agentActivityRow.last_action_at || null,
      lastActionType: agentActivityRow.last_action_type || null,
    };

    // Filter active invoices (unpaid only)
    const activeInvoices = activeInvoicesResult.rows;

    logInfo(LOG_MODULE, handler, 'Customer detail fetched with enhanced dashboard data', {
      customerId: id,
      invoices: invoiceResult.data.length,
      activeInvoices: activeInvoices.length,
      emailLogs: emailLogsResult.rows.length,
      riskScore: customer.customer_risk_score,
    });

    res.status(200).json({
      data: {
        customer,
        invoices: invoiceResult.data,
        emailLogs: emailLogsResult.rows,
        stats,
        // NEW: Customer health dashboard fields
        arHealth,
        paymentInsights,
        riskFactors: riskFactorsArray,
        riskTrend,
        communicationHealth,
        paymentTimeline,
        agentActivity,
        activeInvoices,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateCustomer';
  const companyId = (req as any).companyId;

  try {
    const customerId = req.params.id as string;
    const { email, phone, phone_opt_in } = req.body as { email?: string; phone?: string | null; phone_opt_in?: boolean };

    const updatingEmail = email !== undefined;
    const updatingPhone = phone !== undefined || phone_opt_in !== undefined;

    if (!updatingEmail && !updatingPhone) {
      sendErrorResponse(res, 400, 'At least one field (email, phone, phone_opt_in) is required');
      return;
    }

    let customer;

    if (updatingEmail) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendErrorResponse(res, 400, 'Invalid email format');
        return;
      }
      customer = await CustomerDB.updateCustomer(customerId, companyId, { email });
    }

    if (updatingPhone) {
      const phoneValue = phone === null ? '' : (phone || '');
      await CustomerDB.updateCustomerPhone(customerId, companyId, phoneValue, phone_opt_in ?? false);
      if (!customer) {
        const found = await CustomerDB.findCustomerById(customerId, companyId);
        if (!found) { sendErrorResponse(res, 404, 'Customer not found'); return; }
        customer = found;
      }
    }

    logInfo(LOG_MODULE, handler, 'Customer updated', { customerId });

    res.status(200).json({
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, 'Failed to update customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/bulk-delete
 * Delete multiple customers by ID
 * Body: { customerIds: string[] }
 */
export const batchDeleteCustomers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'batchDeleteCustomers';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    const { customerIds } = req.body as { customerIds?: string[] };

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      sendErrorResponse(res, 400, 'customerIds array is required and must not be empty');
      return;
    }

    if (customerIds.length > 1000) {
      sendErrorResponse(res, 400, 'Maximum 1000 customers per delete operation');
      return;
    }

    // Delete customers in one query
    const result = await pool.query(
      `DELETE FROM customers WHERE company_id = $1 AND id = ANY($2)`,
      [companyId, customerIds]
    );

    const deleted = result.rowCount || 0;

    logInfo(LOG_MODULE, handler, `Batch delete completed in ${Date.now() - startTime}ms`, {
      companyId,
      requested: customerIds.length,
      deleted,
    });

    res.status(200).json({
      data: {
        deleted,
        requested: customerIds.length,
        message: `Successfully deleted ${deleted} customer${deleted !== 1 ? 's' : ''}`,
      },
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `Batch delete failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/import-csv
 * Import customers from raw CSV text with intelligent column mapping
 * Body: Raw CSV text (sent as text/plain)
 */
export const importCustomersCSV = async (req: Request, res: Response): Promise<void> => {
  const handler = 'importCustomersCSV';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    // Handle file as raw text
    let csvText = '';
    if (typeof req.body === 'string') {
      csvText = req.body;
    } else if (req.body.csv) {
      csvText = req.body.csv;
    }

    if (!csvText || csvText.trim().length === 0) {
      sendErrorResponse(res, 400, 'CSV content is required');
      return;
    }

    // Parse CSV with intelligent column detection
    const lines = csvText.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      sendErrorResponse(res, 400, 'CSV must contain header and at least one row');
      return;
    }

    // Parse header - normalize column names
    const rawHeader = lines[0].split(',').map(h => h.trim());
    const header = rawHeader.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Intelligent column detection - exact match first, then smart matching
    const findColumn = (patterns: string[]): number => {
      // FIRST: Try exact match (case-insensitive)
      for (const pattern of patterns) {
        const exactIdx = header.findIndex(h => h === pattern);
        if (exactIdx !== -1) return exactIdx;
      }

      // SECOND: Try substring match
      for (const pattern of patterns) {
        const substringIdx = header.findIndex(h => h.includes(pattern));
        if (substringIdx !== -1) return substringIdx;
      }

      // THIRD: Try word-part matching (split by delimiters)
      return header.findIndex(h => {
        const headerWords = h.split(/[_\-\s]+/).filter(w => w.length > 0);
        return patterns.some(pattern => {
          const patternWords = pattern.split(/[_\-\s]+/).filter(w => w.length > 0);
          return patternWords.some(pw =>
            headerWords.some(hw => hw.includes(pw) || pw.includes(hw))
          );
        });
      });
    };

    // Find columns (company_name & email required)
    const companyNameIdx = findColumn(['companyname', 'company', 'business', 'org', 'organization', 'name']);
    const emailIdx = findColumn(['email', 'mail', 'contact', 'address', 'emailaddress']);
    const contactNameIdx = findColumn(['contactname', 'contact', 'personname', 'firstname']); // Optional contact person
    const phoneIdx = findColumn(['phone', 'telephone', 'mobile', 'cell', 'number']);
    const optInIdx = findColumn(['optin', 'opt_in', 'phoneoptin', 'sms', 'opted']);

    logInfo(LOG_MODULE, handler, 'CSV column detection', {
      headers: rawHeader,
      detectedColumns: { companyNameIdx, emailIdx, contactNameIdx, phoneIdx, optInIdx },
    });

    // STEP 1: Parse & normalize all customers IN MEMORY
    const normalized: Array<{ company_name: string; name?: string; email: string; phone?: string; phone_opt_in: boolean }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.every(v => !v)) continue; // Skip empty rows

      // Extract values with fallbacks
      let companyName = companyNameIdx >= 0 ? values[companyNameIdx] : '';
      let email = emailIdx >= 0 ? values[emailIdx] : '';
      let contactName = contactNameIdx >= 0 ? values[contactNameIdx] : '';
      const phone = phoneIdx >= 0 ? values[phoneIdx] : '';
      const optIn = optInIdx >= 0 ? values[optInIdx] : '';

      // AUTO-INFER MISSING COMPANY_NAME
      if (!companyName && email) {
        companyName = email.split('@')[0];
      }
      if (!companyName) {
        const uniqueId = values.find(v => v && !v.includes(' ') && v.length > 2);
        companyName = uniqueId || `Company ${i}`;
      }

      // AUTO-INFER MISSING EMAIL
      if (!email) {
        const emailValue = values.find(v => v.includes('@'));
        email = emailValue || `contact@${companyName.toLowerCase().replace(/\s+/g, '')}.local`;
      }

      // Validate email
      if (!email.includes('@')) {
        continue;
      }

      normalized.push({
        company_name: companyName.trim(),
        name: contactName ? contactName.trim() : undefined, // Optional contact person
        email: email.toLowerCase(),
        phone: phone || undefined,
        phone_opt_in: optIn.toLowerCase() === 'true' || optIn === '1',
      });
    }

    // Check limits
    if (normalized.length === 0) {
      sendErrorResponse(res, 400, 'No valid customers could be extracted from CSV');
      return;
    }

    if (normalized.length > 500) {
      sendErrorResponse(res, 400, `Too many customers (${normalized.length}). Maximum 500 per upload`);
      return;
    }

    // STEP 2: Bulk find-or-create customers (1 SQL call for existing lookup)
    // FIX #6: Changed from email-based lookup to company_name-based (new identifier)
    const uniqueCompanyNames = [...new Set(normalized.map(c => c.company_name))];
    const customerByCompanyNameMap = new Map<string, string>(); // company_name -> id
    const customerByEmailMap = new Map<string, string>(); // email -> id (for updating existing)
    let skipped = 0;

    // Get existing customers by COMPANY_NAME (primary identifier)
    if (uniqueCompanyNames.length > 0) {
      const existing = await pool.query(
        `SELECT id, company_name, email FROM customers WHERE company_id = $1 AND company_name = ANY($2)`,
        [companyId, uniqueCompanyNames]
      );
      existing.rows.forEach((row: any) => {
        customerByCompanyNameMap.set(row.company_name, row.id);
        if (row.email) customerByEmailMap.set(row.email, row.id);
      });
    }

    // Create missing customers in BULK (1 SQL call)
    // Only create if company_name doesn't already exist
    const missingCompanyNames = uniqueCompanyNames.filter(name => !customerByCompanyNameMap.has(name));
    let created = 0;

    if (missingCompanyNames.length > 0) {
      // Build maps from normalized data
      const companyNameToEmailMap = new Map<string, string>();
      const companyNameToContactNameMap = new Map<string, string | undefined>();
      const companyNameToPhoneMap = new Map<string, string | undefined>();
      for (const cust of normalized) {
        companyNameToEmailMap.set(cust.company_name, cust.email);
        if (cust.name) companyNameToContactNameMap.set(cust.company_name, cust.name);
        if (cust.phone) companyNameToPhoneMap.set(cust.company_name, cust.phone);
      }

      // Build parameters for bulk insert (company_id, company_name, name, email, phone)
      const vals = missingCompanyNames.map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(',');
      const params = [companyId, ...missingCompanyNames.flatMap(name => [
        name,
        companyNameToContactNameMap.get(name) || null,
        companyNameToEmailMap.get(name) || null,
        companyNameToPhoneMap.get(name) || null
      ])];

      const newCustomers = await pool.query(
        `INSERT INTO customers (company_id, company_name, name, email, phone) VALUES ${vals} RETURNING id, company_name, email`,
        params
      );
      newCustomers.rows.forEach((row: any) => {
        customerByCompanyNameMap.set(row.company_name, row.id);
        if (row.email) customerByEmailMap.set(row.email, row.id);
      });
      created = newCustomers.rows.length;
    } else {
      skipped = normalized.length;
    }

    // STEP 3: Update phones and contact info IN BULK
    // FIX #6: Update for customers that already existed or were just created
    const phonesToUpdate = normalized.filter(c => c.phone && customerByCompanyNameMap.has(c.company_name));
    if (phonesToUpdate.length > 0) {
      for (const cust of phonesToUpdate) {
        const custId = customerByCompanyNameMap.get(cust.company_name);
        if (custId) {
          await CustomerDB.updateCustomerPhone(custId, companyId, cust.phone!, cust.phone_opt_in);
        }
      }
    }

    // Also update emails for existing customers if email is provided
    const emailsToUpdate = normalized.filter(c => c.email && customerByCompanyNameMap.has(c.company_name));
    if (emailsToUpdate.length > 0) {
      for (const cust of emailsToUpdate) {
        const custId = customerByCompanyNameMap.get(cust.company_name);
        if (custId) {
          // Use updateCustomer to update email
          await CustomerDB.updateCustomer(custId, companyId, { email: cust.email });
        }
      }
    }

    const existing = uniqueCompanyNames.length - created;
    logInfo(LOG_MODULE, handler, `CSV import completed in ${Date.now() - startTime}ms`, {
      companyId,
      total: normalized.length,
      created,
      existing,
    });

    res.status(200).json({
      data: {
        created,
        existing,
        total: normalized.length,
        message: `Successfully imported ${created} customer${created !== 1 ? 's' : ''}${existing > 0 ? `, ${existing} already existed` : ''}`,
      },
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `CSV import failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/unsubscribe (no auth — customers click link from email)
 * Body: { token, email, companyId } where token = HMAC-SHA256(email:companyId)
 */
export const unsubscribeCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'unsubscribeCustomer';
  try {
    const { token, email, companyId } = req.body as { token?: string; email?: string; companyId?: string };
    if (!token || !email || !companyId) {
      sendErrorResponse(res, 400, 'Missing token, email, or companyId');
      return;
    }

    // Verify HMAC token
    const crypto = require('crypto');
    const { config } = require('../config/env');
    const unsubData = `${email}:${companyId}`;
    const hmac = crypto.createHmac('sha256', config.jwtSecret || 'fallback-secret');
    hmac.update(unsubData);
    const expectedToken = hmac.digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      sendErrorResponse(res, 400, 'Invalid unsubscribe token');
      return;
    }

    await pool.query(
      `UPDATE customers SET do_not_email = true WHERE email = $1 AND company_id = $2`,
      [email, companyId]
    );

    logInfo(LOG_MODULE, handler, 'Customer unsubscribed', { email, companyId });
    res.status(200).json({ message: 'You have been unsubscribed from future emails.' });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Unsubscribe failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
