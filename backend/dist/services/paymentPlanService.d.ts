import { PaymentPlanRow } from '../types/database';
export declare function createPlanForInvoice(invoiceId: string, companyId: string, numInstallments: number): Promise<PaymentPlanRow>;
export declare function chargeInstallment(planId: string, installmentIndex: number, companyId: string, stripeCustomerId: string, paymentMethodId: string): Promise<{
    paymentIntentId: string;
    status: string;
}>;
