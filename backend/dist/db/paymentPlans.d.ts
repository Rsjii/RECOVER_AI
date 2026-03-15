import { PaymentPlanRow } from '../types/database';
export interface Installment {
    amount: number;
    due_date: string;
    paid: boolean;
    stripe_payment_intent_id?: string;
}
export interface CreatePaymentPlanInput {
    invoiceId: string;
    installments: Installment[];
    totalAmount: number;
}
export declare function createPaymentPlan(input: CreatePaymentPlanInput): Promise<PaymentPlanRow>;
export declare function findPaymentPlanByInvoice(invoiceId: string, companyId: string): Promise<PaymentPlanRow | null>;
export declare function findPaymentPlanById(planId: string, companyId: string): Promise<PaymentPlanRow | null>;
export declare function updateInstallmentPaid(planId: string, installmentIndex: number, stripePaymentIntentId: string): Promise<PaymentPlanRow>;
export declare function updatePaymentPlanStatus(planId: string, companyId: string, status: 'active' | 'completed' | 'defaulted'): Promise<PaymentPlanRow>;
export declare function listPaymentPlans(companyId: string): Promise<PaymentPlanRow[]>;
