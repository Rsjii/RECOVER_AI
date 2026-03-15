import { pool } from '../config/database';

export interface CreatePolicyApprovalInput {
  companyId: string;
  invoiceId?: string;
  requestedByUserId?: string;
  riskScore: number;
  daysOverdue: number;
  reason?: string;
}

export async function createPolicyApproval(input: CreatePolicyApprovalInput): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO policy_approvals (
       company_id, invoice_id, requested_by_user_id, status, risk_score, days_overdue, reason
     ) VALUES ($1,$2,$3,'pending',$4,$5,$6)
     RETURNING id`,
    [
      input.companyId,
      input.invoiceId || null,
      input.requestedByUserId || null,
      input.riskScore,
      input.daysOverdue,
      input.reason || null,
    ]
  );
  return result.rows[0];
}

export async function listPolicyApprovals(companyId: string, status?: 'pending' | 'approved' | 'rejected'): Promise<any[]> {
  const params: unknown[] = [companyId];
  let statusFilter = '';
  if (status) {
    params.push(status);
    statusFilter = ` AND pa.status = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT pa.*,
            u1.email AS requested_by_email,
            u2.email AS approved_by_email
     FROM policy_approvals pa
     LEFT JOIN users u1 ON u1.id = pa.requested_by_user_id
     LEFT JOIN users u2 ON u2.id = pa.approved_by_user_id
     WHERE pa.company_id = $1
     ${statusFilter}
     ORDER BY pa.requested_at DESC
     LIMIT 200`,
    params
  );
  return result.rows;
}

export async function decidePolicyApproval(input: {
  id: string;
  companyId: string;
  approvedByUserId: string;
  status: 'approved' | 'rejected';
  decisionNote?: string;
}): Promise<boolean> {
  const result = await pool.query(
    `UPDATE policy_approvals
     SET status = $1,
         decision_note = $2,
         approved_by_user_id = $3,
         decided_at = NOW()
     WHERE id = $4
       AND company_id = $5
       AND status = 'pending'
     RETURNING id`,
    [input.status, input.decisionNote || null, input.approvedByUserId, input.id, input.companyId]
  );
  return !!result.rows[0];
}







