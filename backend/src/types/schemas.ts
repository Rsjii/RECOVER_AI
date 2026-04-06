import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const connectStripeSchema = z.object({
  stripe_api_key: z
    .string()
    .min(10, 'Invalid Stripe key')
    .refine(k => k.startsWith('sk_live_') || k.startsWith('sk_test_'), 'Key must start with sk_live_ or sk_test_'),
  stripe_webhook_secret: z
    .string()
    .min(20, 'Invalid webhook secret')
    .refine(s => s.startsWith('whsec_'), 'Secret must start with whsec_')
    .optional(),  // OPTIONAL - user can add later
});

export const createPaymentPlanSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  numInstallments: z.number().int().min(2).max(12).optional().default(3),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['unpaid', 'paid', 'arranged', 'disputed', 'uncollectable']),
});

export const dunningSettingsSchema = z.object({
  num_emails: z.number().int().min(1).max(10),
  days_between: z.number().int().min(1).max(90),
  approval_required: z.boolean(),
});

export const slackWebhookSchema = z.object({
  webhookUrl: z.string().url('Invalid URL').startsWith('https://hooks.slack.com/', 'Must be a Slack webhook URL'),
});

export const generalSettingsSchema = z.object({
  timezone: z.string().min(1),
  preferredCurrency: z.string().length(3),
});

