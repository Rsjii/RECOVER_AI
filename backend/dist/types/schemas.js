"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalSettingsSchema = exports.slackWebhookSchema = exports.dunningSettingsSchema = exports.updateInvoiceStatusSchema = exports.createPaymentPlanSchema = exports.connectStripeSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
exports.signupSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
    companyName: zod_1.z.string().min(2, 'Company name must be at least 2 characters').max(100),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.connectStripeSchema = zod_1.z.object({
    stripe_api_key: zod_1.z
        .string()
        .min(10, 'Invalid Stripe key')
        .refine(k => k.startsWith('sk_live_') || k.startsWith('sk_test_'), 'Key must start with sk_live_ or sk_test_'),
});
exports.createPaymentPlanSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('Invalid invoice ID'),
    numInstallments: zod_1.z.number().int().min(2).max(12).optional().default(3),
});
exports.updateInvoiceStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['unpaid', 'paid', 'arranged', 'disputed', 'uncollectable']),
});
exports.dunningSettingsSchema = zod_1.z.object({
    num_emails: zod_1.z.number().int().min(1).max(10),
    days_between: zod_1.z.number().int().min(1).max(90),
    approval_required: zod_1.z.boolean(),
});
exports.slackWebhookSchema = zod_1.z.object({
    webhookUrl: zod_1.z.string().url('Invalid URL').startsWith('https://hooks.slack.com/', 'Must be a Slack webhook URL'),
});
exports.generalSettingsSchema = zod_1.z.object({
    timezone: zod_1.z.string().min(1),
    preferredCurrency: zod_1.z.string().length(3),
});
