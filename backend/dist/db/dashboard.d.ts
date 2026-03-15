export interface RecoveryStats {
    totalInvoices: number;
    totalOwed: number;
    totalRecovered: number;
    recoveryRate: number;
    avgDaysToCollect: number;
    overdueCount: number;
    overdueAmount: number;
}
export interface InvoicePipeline {
    unpaid: number;
    arranged: number;
    disputed: number;
    uncollectable: number;
    paid: number;
    unpaidAmount: number;
    arrangedAmount: number;
}
export interface CustomerRiskItem {
    customerId: string;
    customerName: string;
    customerEmail: string;
    unpaidInvoices: number;
    totalOwed: number;
    maxRiskScore: number;
    oldestDueDays: number;
}
export declare function getRecoveryStats(companyId: string): Promise<RecoveryStats>;
export declare function getInvoicePipeline(companyId: string): Promise<InvoicePipeline>;
export declare function getCustomerRiskList(companyId: string, limit?: number): Promise<CustomerRiskItem[]>;
