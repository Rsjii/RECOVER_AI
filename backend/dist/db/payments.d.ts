import { PaymentRow } from '../types/database';
export interface CreatePaymentInput {
    invoiceId: string;
    companyId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    paidAt: Date;
    stripeChargeId?: string;
    status?: 'pending' | 'succeeded' | 'failed';
    notes?: string;
}
export declare function createPayment(input: CreatePaymentInput): Promise<PaymentRow>;
export declare function listPaymentsByInvoice(invoiceId: string, companyId: string): Promise<PaymentRow[]>;
export declare function listPaymentsByCompany(companyId: string, limit?: number, offset?: number): Promise<{
    data: PaymentRow[];
    total: number;
}>;
export declare function findPaymentByStripeChargeId(stripeChargeId: string): Promise<PaymentRow | null>;
export declare function countEmailsSentToday(companyId: string): Promise<number>;
