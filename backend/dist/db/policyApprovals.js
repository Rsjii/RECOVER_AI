"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolicyApproval = createPolicyApproval;
exports.listPolicyApprovals = listPolicyApprovals;
exports.decidePolicyApproval = decidePolicyApproval;
const database_1 = require("../config/database");
async function createPolicyApproval(input) {
    const result = await database_1.pool.query(`INSERT INTO policy_approvals (
       company_id, invoice_id, requested_by_user_id, status, risk_score, days_overdue, reason
     ) VALUES ($1,$2,$3,'pending',$4,$5,$6)
     RETURNING id`, [
        input.companyId,
        input.invoiceId || null,
        input.requestedByUserId || null,
        input.riskScore,
        input.daysOverdue,
        input.reason || null,
    ]);
    return result.rows[0];
}
async function listPolicyApprovals(companyId, status) {
    const params = [companyId];
    let statusFilter = '';
    if (status) {
        params.push(status);
        statusFilter = ` AND pa.status = $${params.length}`;
    }
    const result = await database_1.pool.query(`SELECT pa.*,
            u1.email AS requested_by_email,
            u2.email AS approved_by_email
     FROM policy_approvals pa
     LEFT JOIN users u1 ON u1.id = pa.requested_by_user_id
     LEFT JOIN users u2 ON u2.id = pa.approved_by_user_id
     WHERE pa.company_id = $1
     ${statusFilter}
     ORDER BY pa.requested_at DESC
     LIMIT 200`, params);
    return result.rows;
}
async function decidePolicyApproval(input) {
    const result = await database_1.pool.query(`UPDATE policy_approvals
     SET status = $1,
         decision_note = $2,
         approved_by_user_id = $3,
         decided_at = NOW()
     WHERE id = $4
       AND company_id = $5
       AND status = 'pending'
     RETURNING id`, [input.status, input.decisionNote || null, input.approvedByUserId, input.id, input.companyId]);
    return !!result.rows[0];
}
