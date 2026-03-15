import { CustomerRow } from '../types/database';
export interface CreateCustomerInput {
    companyId: string;
    name: string;
    email: string;
    companyName?: string;
    phone?: string;
}
export declare function findOrCreateCustomer(input: CreateCustomerInput): Promise<CustomerRow>;
export declare function findCustomerById(id: string, companyId: string): Promise<CustomerRow | null>;
export declare function listCustomers(companyId: string, limit?: number, offset?: number): Promise<{
    data: CustomerRow[];
    total: number;
}>;
/**
 * Recompute and persist customer payment_history from actual invoice/payment data
 */
export declare function updateCustomerPaymentHistory(customerId: string): Promise<void>;
