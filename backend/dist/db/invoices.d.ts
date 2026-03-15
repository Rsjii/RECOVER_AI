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
export declare function upsertInvoice(input: CreateInvoiceInput): Promise<{
    row: InvoiceRow;
    isNew: boolean;
}>;
export declare function createManualInvoice(input: CreateInvoiceInput): Promise<InvoiceRow>;
export declare function listInvoices(companyId: string, filters?: {
    status?: string;
    customerId?: string;
}, limit?: number, offset?: number): Promise<{
    data: InvoiceRow[];
    total: number;
}>;
export declare function findInvoiceById(id: string, companyId: string): Promise<InvoiceRow | null>;
export declare function findInvoiceBySourceId(sourceId: string, source: string, companyId?: string): Promise<InvoiceRow | null>;
export declare function updateInvoiceStatus(id: string, companyId: string, status: string): Promise<InvoiceRow>;
export declare function updateInvoiceRiskScore(id: string, companyId: string, riskScore: number): Promise<void>;
