import { z } from 'zod';
export declare const signupSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    companyName: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const connectStripeSchema: z.ZodObject<{
    stripe_api_key: z.ZodString;
}, z.core.$strip>;
export declare const createPaymentPlanSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    numInstallments: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const updateInvoiceStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        unpaid: "unpaid";
        paid: "paid";
        arranged: "arranged";
        disputed: "disputed";
        uncollectable: "uncollectable";
    }>;
}, z.core.$strip>;
export declare const dunningSettingsSchema: z.ZodObject<{
    num_emails: z.ZodNumber;
    days_between: z.ZodNumber;
    approval_required: z.ZodBoolean;
}, z.core.$strip>;
export declare const slackWebhookSchema: z.ZodObject<{
    webhookUrl: z.ZodString;
}, z.core.$strip>;
export declare const generalSettingsSchema: z.ZodObject<{
    timezone: z.ZodString;
    preferredCurrency: z.ZodString;
}, z.core.$strip>;
