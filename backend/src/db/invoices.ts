import { pool } from '../config/database';
import { InvoiceRow } from '../types/database';

export interface CreateInvoiceInput {
  companyId: string;
  customerId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  issuedDate: Date;
  source?: string;
  sourceId?: string | null;
  notes?: string;
}

export async function upsertInvoice(input: CreateInvoiceInput): Promise<{ row: InvoiceRow; isNew: boolean }> {
  const { companyId, customerId, amount, currency, dueDate, issuedDate, source, sourceId } = input;

  if (sourceId) {
    const existing = await pool.query(
      'SELECT * FROM invoices WHERE company_id = $1 AND source = $2 AND source_id = $3',
      [companyId, source, sourceId]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE invoices SET customer_id = $1, amount = $2, currency = $3, due_date = $4, updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [customerId, amount, currency, dueDate, existing.rows[0].id]
      );
      return { row: updated.rows[0], isNew: false };
    }
  }

  const result = await pool.query(
    `INSERT INTO invoices
       (company_id, customer_id, amount, currency, due_date, issued_date, source, source_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid')
     RETURNING *`,
    [companyId, customerId, amount, currency, dueDate, issuedDate, source, sourceId || null]
  );

  return { row: result.rows[0], isNew: true };
}

export async function createManualInvoice(input: CreateInvoiceInput): Promise<InvoiceRow> {
  const { companyId, customerId, amount, currency, dueDate, issuedDate, notes } = input;

  const result = await pool.query(
    `INSERT INTO invoices
       (company_id, customer_id, amount, currency, due_date, issued_date, source, source_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual', NULL, 'unpaid', $7)
     RETURNING *`,
    [companyId, customerId, amount, currency, dueDate, issuedDate, notes || null]
  );

  return result.rows[0];
}

export async function listInvoices(
  companyId: string,
  filters: { status?: string; customerId?: string; agingBucket?: string; dunningStage?: string; sort?: string } = {},
  limit = 50,
  offset = 0
): Promise<{ data: InvoiceRow[]; total: number }> {
  const conditions: string[] = ['i.company_id = $1'];
  const params: any[] = [companyId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`i.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.customerId) {
    conditions.push(`i.customer_id = $${paramIndex++}`);
    params.push(filters.customerId);
  }

  if (filters.agingBucket) {
    switch (filters.agingBucket) {
      case '0-30':
        conditions.push(`i.due_date >= NOW() - INTERVAL '30 days'`);
        break;
      case '31-60':
        conditions.push(`i.due_date < NOW() - INTERVAL '30 days' AND i.due_date >= NOW() - INTERVAL '60 days'`);
        break;
      case '61-90':
        conditions.push(`i.due_date < NOW() - INTERVAL '60 days' AND i.due_date >= NOW() - INTERVAL '90 days'`);
        break;
      case '90+':
        conditions.push(`i.due_date < NOW() - INTERVAL '90 days'`);
        break;
    }
  }

  const where = conditions.join(' AND ');

  // Dynamic ORDER BY based on sort param
  const ORDER_MAP: Record<string, string> = {
    'amount_asc': 'i.amount ASC',
    'amount_desc': 'i.amount DESC',
    'due_date_asc': 'i.due_date ASC',
    'due_date_desc': 'i.due_date DESC',
    'days_overdue_asc': 'i.due_date ASC',
    'days_overdue_desc': 'i.due_date DESC',
  };
  const orderBy = (filters.sort && ORDER_MAP[filters.sort]) || 'i.due_date ASC';

  const [data, count] = await Promise.all([
    pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM invoices i WHERE ${where}`, params),
  ]);

  return { data: data.rows, total: parseInt(count.rows[0].count) };
}

export async function findInvoiceById(id: string, companyId: string): Promise<InvoiceRow | null> {
  const result = await pool.query(
    `SELECT i.*, c.name as customer_name, c.email as customer_email
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.id = $1 AND i.company_id = $2`,
    [id, companyId]
  );
  return result.rows[0] || null;
}

export async function findInvoiceBySourceId(
  sourceId: string,
  source: string,
  companyId?: string
): Promise<InvoiceRow | null> {
  const params: unknown[] = [sourceId, source];
  let companyFilter = '';

  if (companyId) {
    params.push(companyId);
    companyFilter = ` AND i.company_id = $${params.length}`;
  }

  const result = await pool.query(
    `SELECT i.*, c.name as customer_name, c.email as customer_email
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.source_id = $1 AND i.source = $2
     ${companyFilter}
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

export async function updateInvoiceStatus(id: string, companyId: string, status: string): Promise<InvoiceRow> {
  const result = await pool.query(
    `UPDATE invoices
     SET status = $1, updated_at = NOW()
     WHERE id = $2
       AND company_id = $3
     RETURNING *`,
    [status, id, companyId]
  );
  return result.rows[0];
}

export async function updateInvoiceRiskScore(id: string, companyId: string, riskScore: number): Promise<void> {
  await pool.query(
    `UPDATE invoices
     SET risk_score = $1, updated_at = NOW()
     WHERE id = $2
       AND company_id = $3`,
    [riskScore, id, companyId]
  );
}

export async function pauseInvoiceDunning(id: string, companyId: string, days: number): Promise<InvoiceRow | null> {
  const result = await pool.query(
    `UPDATE invoices
     SET dunning_paused_until = NOW() + ($1 || ' days')::INTERVAL, updated_at = NOW()
     WHERE id = $2
       AND company_id = $3
     RETURNING *`,
    [days, id, companyId]
  );
  return result.rows[0] || null;
}

export async function resumeInvoiceDunning(id: string, companyId: string): Promise<InvoiceRow | null> {
  const result = await pool.query(
    `UPDATE invoices
     SET dunning_paused_until = NULL, updated_at = NOW()
     WHERE id = $1
       AND company_id = $2
     RETURNING *`,
    [id, companyId]
  );
  return result.rows[0] || null;
}

export async function stopInvoiceDunning(id: string, companyId: string): Promise<InvoiceRow | null> {
  const result = await pool.query(
    `UPDATE invoices
     SET dunning_stopped = TRUE, updated_at = NOW()
     WHERE id = $1
       AND company_id = $2
     RETURNING *`,
    [id, companyId]
  );
  return result.rows[0] || null;
}

export async function deleteInvoice(id: string, companyId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete all related records in a single transaction
    await client.query('DELETE FROM payments WHERE invoice_id = $1', [id]);
    await client.query('DELETE FROM email_logs WHERE invoice_id = $1', [id]);
    await client.query('DELETE FROM payment_plans WHERE invoice_id = $1', [id]);
    await client.query('DELETE FROM invoices WHERE id = $1 AND company_id = $2', [id, companyId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDuplicateInvoice(
  companyId: string,
  customerId: string,
  amount: number,
  dueDate: Date
): Promise<boolean> {
  const dueDateStr = dueDate.toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT 1 FROM invoices
     WHERE company_id = $1
       AND customer_id = $2
       AND ABS(amount - $3) < 0.01
       AND due_date::date = $4::date
     LIMIT 1`,
    [companyId, customerId, amount, dueDateStr]
  );
  return result.rows.length > 0;
}

export async function getAllInvoiceIds(
  companyId: string,
  filters: { status?: string; customerId?: string; agingBucket?: string; dunningStage?: string; search?: string } = {}
): Promise<string[]> {
  const conditions: string[] = ['i.company_id = $1'];
  const params: any[] = [companyId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`i.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.customerId) {
    conditions.push(`i.customer_id = $${paramIndex++}`);
    params.push(filters.customerId);
  }

  if (filters.search) {
    conditions.push(`(LOWER(c.name) ILIKE $${paramIndex} OR LOWER(c.email) ILIKE $${paramIndex++})`);
    params.push(`%${filters.search.toLowerCase()}%`);
  }

  if (filters.agingBucket) {
    switch (filters.agingBucket) {
      case '0-30':
        conditions.push(`i.due_date >= NOW() - INTERVAL '30 days'`);
        break;
      case '31-60':
        conditions.push(`i.due_date < NOW() - INTERVAL '30 days' AND i.due_date >= NOW() - INTERVAL '60 days'`);
        break;
      case '61-90':
        conditions.push(`i.due_date < NOW() - INTERVAL '60 days' AND i.due_date >= NOW() - INTERVAL '90 days'`);
        break;
      case '90+':
        conditions.push(`i.due_date < NOW() - INTERVAL '90 days'`);
        break;
    }
  }

  const where = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT i.id FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE ${where}
     ORDER BY i.due_date ASC`,
    params
  );

  return result.rows.map(row => row.id);
}
