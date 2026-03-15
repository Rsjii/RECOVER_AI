export interface CreatePolicyApprovalInput {
    companyId: string;
    invoiceId?: string;
    requestedByUserId?: string;
    riskScore: number;
    daysOverdue: number;
    reason?: string;
}
export declare function createPolicyApproval(input: CreatePolicyApprovalInput): Promise<{
    id: string;
}>;
export declare function listPolicyApprovals(companyId: string, status?: 'pending' | 'approved' | 'rejected'): Promise<any[]>;
export declare function decidePolicyApproval(input: {
    id: string;
    companyId: string;
    approvedByUserId: string;
    status: 'approved' | 'rejected';
    decisionNote?: string;
}): Promise<boolean>;
