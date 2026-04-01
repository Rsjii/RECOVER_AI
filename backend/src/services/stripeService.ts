import Stripe from 'stripe';
import { config } from '../config/env';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import * as CompanyDB from '../db/companies';
import * as AuditDB from '../db/auditLogs';
import * as PaymentDB from '../db/payments';
import * as SecurityDB from '../db/security';
import crypto from 'crypto';
import { pool } from '../config/database';
import { sendPaymentAlert } from './slackService';
import { ConnectStripeInput, SyncInvoicesResult } from '../types/stripe';
import { encryptField, decryptField } from '../lib/encryption';
import { logError, logInfo, logWarn } from '../utils/logger';
import { classifyDeclineCode, recordDeclineOccurrence } from './declineCodeService';
import { createPlanForInvoice } from './paymentPlanService';
import { getOptimalRetryTime } from './paymentBehaviorService';
import { addRetryJob } from '../queue/retryQueue';
import { logIntegrationSync } from '../db/integrationLogs';
import resendService from './resendService';

function getStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey);
}

class StripeService {
  async connectStripe(companyId: string, userId: string, input: ConnectStripeInput): Promise<void> {
    const method = 'connectStripe';
    const startTime = Date.now();
    try {
      const { stripe_api_key } = input;

      logInfo('stripeService', method, 'Starting Stripe connect', { companyId, userId });

      // Validate stripe_api_key is not empty
      if (!stripe_api_key || typeof stripe_api_key !== 'string' || stripe_api_key.trim().length === 0) {
        throw new Error('stripe_api_key must be a non-empty string');
      }

      const stripe = getStripeClient(stripe_api_key);
      await stripe.accounts.retrieve();

      const encrypted = encryptField(stripe_api_key);
      await CompanyDB.updateCompany(companyId, { stripe_api_key_encrypted: encrypted });

      await AuditDB.createAuditLog({
        companyId,
        userId,
        action: 'CONNECT',
        resourceType: 'integration',
        details: { integration: 'stripe' },
      });

      logInfo('stripeService', method, 'Stripe connected successfully', {
        companyId,
        elapsedMs: Date.now() - startTime,
      });
    } catch (error) {
      logError('stripeService', method, 'Stripe connect failed', error, {
        companyId,
        elapsedMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  async syncInvoices(companyId: string): Promise<SyncInvoicesResult> {
    const method = 'syncInvoices';
    const startTime = Date.now();
    try {
      logInfo('stripeService', method, 'Starting Stripe sync', { companyId });
      const company = await CompanyDB.findCompanyById(companyId);
      if (!company?.stripe_api_key_encrypted) {
        throw new Error('Stripe not connected for this company');
      }

      const apiKey = decryptField(company.stripe_api_key_encrypted);
      const stripe = getStripeClient(apiKey);

      const result: SyncInvoicesResult = { created: 0, updated: 0, skipped: 0, skippedDetails: [] };

      const stripeInvoices = await stripe.invoices.list({ status: 'open', limit: 100 });

      for (const inv of stripeInvoices.data) {
        if (!inv.customer_email) {
          result.skipped++;
          result.skippedDetails.push({
            stripeInvoiceId: inv.id,
            customerName: inv.customer_name || undefined,
            amount: inv.amount_due / 100,
            reason: 'NO_EMAIL',
          });
          continue;
        }

        if (inv.amount_due === 0) {
          result.skipped++;
          result.skippedDetails.push({
            stripeInvoiceId: inv.id,
            customerName: inv.customer_name || inv.customer_email,
            amount: 0,
            reason: 'ZERO_AMOUNT',
          });
          continue;
        }

        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: inv.customer_name || inv.customer_email,
          email: inv.customer_email,
        });

        const { isNew } = await InvoiceDB.upsertInvoice({
          companyId,
          customerId: customer.id,
          amount: inv.amount_due / 100,
          currency: inv.currency.toUpperCase(),
          dueDate: inv.due_date ? new Date(inv.due_date * 1000) : new Date(),
          issuedDate: new Date(inv.created * 1000),
          source: 'stripe',
          sourceId: inv.id,
        });

        isNew ? result.created++ : result.updated++;
      }

      // Update last synced timestamp
      await CompanyDB.updateCompany(companyId, { stripe_last_synced_at: new Date() });

      logInfo('stripeService', method, 'Stripe sync completed', {
        companyId,
        elapsedMs: Date.now() - startTime,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      });

      // Non-blocking audit write
      logIntegrationSync({
        companyId,
        integration: 'stripe',
        action: 'sync',
        status: 'success',
        recordsCount: result.created + result.updated,
        details: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          skippedDetails: result.skippedDetails,
        },
      }).catch((err) => logError('stripeService', method, 'Failed to log integration sync', err));

      return result;
    } catch (error) {
      logError('stripeService', method, 'Stripe sync failed', error, {
        companyId,
        elapsedMs: Date.now() - startTime,
      });
      // Non-blocking error log
      logIntegrationSync({
        companyId,
        integration: 'stripe',
        action: 'sync',
        status: 'error',
        recordsCount: 0,
        errorMessage: (error as Error).message,
      }).catch(() => { /* silent */ });
      throw error;
    }
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const method = 'handleWebhook';
    const startTime = Date.now();
    let processedEventId: string | null = null;
    try {
      const webhookSecret = config.stripe.webhookSecret;
      if (!webhookSecret) throw new Error('Stripe webhook secret not configured');

      const stripe = new Stripe(config.stripe.apiKey || '');
      const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret, 300);
      processedEventId = event.id;

      // Additional replay protection guard: stale events beyond 24h are ignored.
      if (Math.abs(Date.now() / 1000 - event.created) > 24 * 60 * 60) {
        logInfo('stripeService', method, 'Ignored stale webhook event', { eventId: event.id, created: event.created });
        return;
      }
      const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
      const accepted = await SecurityDB.registerWebhookEvent({
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
        payloadHash,
      });
      if (!accepted) {
        logInfo('stripeService', method, 'Duplicate webhook ignored', { eventId: event.id, eventType: event.type });
        return;
      }

      logInfo('stripeService', method, 'Processing webhook', { eventType: event.type });

      switch (event.type) {
        case 'invoice.paid': {
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        }
        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          logInfo('stripeService', method, 'Invoice payment failed', {
            stripeInvoiceId: inv.id,
            customerId: inv.customer,
          });
          // Dunning worker will handle re-sending emails automatically on next cycle
          break;
        }
        case 'charge.succeeded': {
          const charge = event.data.object as Stripe.Charge;
          logInfo('stripeService', method, 'Charge succeeded', { chargeId: charge.id });
          // charge.succeeded fires alongside invoice.paid — avoid duplicate handling
          // Only handle if no invoice attached (direct charge scenario)
          if (!(charge as any).invoice) {
            await this.handleDirectCharge(charge);
          }
          break;
        }
        case 'charge.failed': {
          const charge = event.data.object as Stripe.Charge;
          logInfo('stripeService', method, 'Charge failed', {
            chargeId: charge.id,
            failureMessage: charge.failure_message,
          });
          await this.handleChargeFailed(charge);
          break;
        }
        default:
          logInfo('stripeService', method, `Unhandled event type: ${event.type}`);
      }

      logInfo('stripeService', method, 'Webhook handled', {
        eventType: event.type,
        eventId: event.id,
        elapsedMs: Date.now() - startTime,
      });
      await SecurityDB.completeWebhookEvent('stripe', event.id);
    } catch (error) {
      if (processedEventId) {
        await SecurityDB.failWebhookEvent('stripe', processedEventId, error instanceof Error ? error.message : String(error));
      }
      logError('stripeService', method, 'Webhook handling failed', error, {
        elapsedMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async handleInvoicePaid(inv: Stripe.Invoice): Promise<void> {
    const method = 'handleInvoicePaid';

    // Find our internal invoice by Stripe invoice ID
    const invoice = await InvoiceDB.findInvoiceBySourceId(inv.id, 'stripe');
    if (!invoice) {
      logInfo('stripeService', method, 'Internal invoice not found for stripe invoice', {
        stripeInvoiceId: inv.id,
      });
      return;
    }

    if (invoice.status === 'paid') {
      logInfo('stripeService', method, 'Invoice already marked as paid', { invoiceId: invoice.id });
      return;
    }

    // Mark invoice as paid
    await InvoiceDB.updateInvoiceStatus(invoice.id, invoice.company_id, 'paid');

    // Record payment
    const amountPaid = (inv.amount_paid || 0) / 100;
    await PaymentDB.createPayment({
      invoiceId: invoice.id,
      companyId: invoice.company_id,
      amount: amountPaid,
      currency: (inv.currency || 'usd').toUpperCase(),
      paymentMethod: 'stripe',
      paidAt: new Date((inv.status_transitions?.paid_at || Date.now() / 1000) * 1000),
      stripeChargeId: typeof (inv as any).charge === 'string' ? (inv as any).charge : (inv as any).charge?.id,
      status: 'succeeded',
    });

    // Update customer payment history
    try {
      await CustomerDB.updateCustomerPaymentHistory(invoice.customer_id);
    } catch (err) {
      logError('stripeService', method, 'Failed to update customer history (non-blocking)', err);
    }

    // Send Slack notification (non-blocking)
    try {
      const { slackNotificationService } = await import('./slackNotificationService');
      const customer = await CustomerDB.findCustomerById(invoice.customer_id, invoice.company_id);
      await slackNotificationService.notifyPaymentReceived({
        companyId: invoice.company_id,
        invoiceId: invoice.id,
        amount: amountPaid,
        customerName: customer?.name || 'Unknown',
        customerId: invoice.customer_id,
      });
    } catch (err) {
      logError('stripeService', method, 'Failed to send Slack notification (non-blocking)', err);
    }

    // P1: Attribution tracking — was this payment recovered by RecoverAI dunning?
    try {
      const dunningCheck = await pool.query(
        `SELECT COUNT(*) as count FROM email_logs
         WHERE invoice_id = $1 AND email_type LIKE 'dunning_%' AND status != 'failed'`,
        [invoice.id]
      );
      if (parseInt(dunningCheck.rows[0].count) > 0) {
        await pool.query(
          `UPDATE invoices
           SET recovered_by_recoverai = true, recovered_amount = $1,
               recovered_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND company_id = $3`,
          [amountPaid, invoice.id, invoice.company_id]
        );
        logInfo('stripeService', method, 'Invoice attributed to RecoverAI recovery', {
          invoiceId: invoice.id,
          amount: amountPaid,
        });
      }
    } catch (attributionErr) {
      logError('stripeService', method, 'Attribution check failed (non-blocking)', attributionErr);
    }

    // Slack alert
    try {
      await sendPaymentAlert({
        customerName: invoice.customer_name || 'Unknown',
        amount: amountPaid,
        currency: invoice.currency,
        invoiceId: invoice.id,
      });
    } catch (err) {
      logError('stripeService', method, 'Failed to send Slack alert (non-blocking)', err);
    }

    // Pilot celebration email — send "X just paid!" to company owner when in pilot mode
    try {
      const company = await CompanyDB.findCompanyById(invoice.company_id);
      if (company && (company as any).account_type === 'pilot' && company.email) {
        const customerName = invoice.customer_name || 'A customer';
        const formattedAmount = amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        await resendService.sendEmail({
          to: company.email,
          subject: `${customerName} just paid $${formattedAmount}! 🎉`,
          bodyHtml: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:16px;">
              <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="background:#16a34a;color:#fff;font-size:36px;width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;">&#127881;</div>
                </div>
                <h1 style="font-size:22px;font-weight:800;color:#111827;text-align:center;margin:0 0 8px;">
                  Payment Received!
                </h1>
                <p style="color:#6b7280;text-align:center;font-size:14px;margin:0 0 24px;">
                  RecoverAI just recovered another invoice for you
                </p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
                  <div style="font-size:36px;font-weight:900;color:#15803d;font-variant-numeric:tabular-nums;">$${formattedAmount}</div>
                  <div style="color:#166534;font-size:14px;margin-top:4px;">paid by <strong>${customerName}</strong></div>
                </div>
                <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">
                  This payment was recovered as part of your RecoverAI pilot. Login to your dashboard to see full recovery stats.
                </p>
                <a href="${process.env.FRONTEND_URL}/dashboard" style="display:block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;text-align:center;font-weight:700;font-size:15px;">
                  View Dashboard
                </a>
              </div>
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">RecoverAI - Autonomous AR Recovery</p>
            </div>
          `,
          bodyText: `${customerName} just paid $${formattedAmount}!\n\nThis payment was recovered as part of your RecoverAI pilot.\n\nLogin: ${process.env.FRONTEND_URL}/dashboard`,
          replyTo: 'hello@recoverai.com',
        });
        logInfo('stripeService', method, 'Pilot celebration email sent', {
          companyId: invoice.company_id,
          amount: amountPaid,
        });
      }
    } catch (notifyErr) {
      logError('stripeService', method, 'Pilot notification failed (non-blocking)', notifyErr);
    }

    logInfo('stripeService', method, 'Invoice paid handled', {
      invoiceId: invoice.id,
      amount: amountPaid,
    });
  }

  private async handleDirectCharge(charge: Stripe.Charge): Promise<void> {
    const method = 'handleDirectCharge';
    // Direct charge (not invoice-based) — log only, no invoice to update
    logInfo('stripeService', method, 'Direct charge succeeded (no invoice)', {
      chargeId: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency,
    });
  }

  private async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    const method = 'handleChargeFailed';

    // Only process if this charge is tied to a Stripe invoice
    // Note: Stripe types don't expose `invoice` on Charge; cast via any
    const rawInvoice = (charge as any).invoice;
    const stripeInvoiceId: string | null = typeof rawInvoice === 'string' ? rawInvoice : rawInvoice?.id ?? null;
    if (!stripeInvoiceId) {
      logInfo('stripeService', method, 'Charge failed but not invoice-linked — skipping', { chargeId: charge.id });
      return;
    }

    // Find our internal invoice by Stripe invoice ID
    const invoice = await InvoiceDB.findInvoiceBySourceId(stripeInvoiceId, 'stripe');
    if (!invoice) {
      logInfo('stripeService', method, 'Internal invoice not found for failed charge', { stripeInvoiceId });
      return;
    }

    if (invoice.status === 'paid') {
      logInfo('stripeService', method, 'Invoice already paid — ignoring failed charge', { invoiceId: invoice.id });
      return;
    }

    // Extract decline code from charge outcome (more specific) or failure_code (general)
    const declineCode = (charge.outcome as any)?.decline_code || charge.failure_code || null;
    const classification = classifyDeclineCode(declineCode, charge.failure_code);

    // Persist decline classification on the invoice
    await pool.query(
      `UPDATE invoices
       SET decline_code = $1, last_decline_type = $2, decline_confidence = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [declineCode, classification.type, classification.confidence, invoice.id, invoice.company_id]
    );

    // Record analytics (non-blocking)
    if (declineCode) {
      recordDeclineOccurrence(invoice.company_id, declineCode).catch(() => {});
    }

    logInfo('stripeService', method, 'Charge failure classified', {
      invoiceId: invoice.id,
      declineCode,
      type: classification.type,
      confidence: classification.confidence,
    });

    if (classification.type === 'fraud') {
      // Stop all dunning — no point retrying
      await InvoiceDB.stopInvoiceDunning(invoice.id, invoice.company_id);
      logInfo('stripeService', method, 'Dunning stopped — fraud decline', { invoiceId: invoice.id });
      return;
    }

    if (classification.type === 'hard') {
      // Create payment plan immediately — card can't be retried
      try {
        await createPlanForInvoice(invoice.id, invoice.company_id, 3);
        logInfo('stripeService', method, 'Payment plan created for hard decline', { invoiceId: invoice.id });
      } catch (err) {
        logWarn('stripeService', method, 'Payment plan creation skipped (may already exist)', {
          invoiceId: invoice.id,
          error: String(err),
        });
      }
      return;
    }

    // Soft decline — schedule intelligent retry
    try {
      const variant: 'optimized' | 'generic' = Math.random() < 0.7 ? 'optimized' : 'generic';
      let delayMs = 24 * 60 * 60 * 1000;  // default: 24h

      if (variant === 'optimized') {
        try {
          const optimalTime = await getOptimalRetryTime(invoice.company_id, invoice.customer_id);
          const computed = optimalTime.getTime() - Date.now();
          delayMs = Math.max(60 * 60 * 1000, computed);  // at least 1h in the future
        } catch (err) {
          logWarn('stripeService', method, 'Optimal retry time failed — using generic 24h', { error: String(err) });
        }
      }

      await addRetryJob(
        {
          invoiceId: invoice.id,
          companyId: invoice.company_id,
          customerId: invoice.customer_id,
          attempt: 1,
          variant,
          declineCode: declineCode || undefined,
        },
        { delay: delayMs }
      );

      logInfo('stripeService', method, 'Retry job queued', {
        invoiceId: invoice.id,
        variant,
        delayHours: Math.round(delayMs / 3600000),
      });
    } catch (err) {
      logError('stripeService', method, 'Failed to queue retry job (non-blocking)', err);
    }
  }

  // OAuth: Exchange authorization code for access token
  async getAccessToken(code: string): Promise<{
    access_token: string;
    stripe_user_id: string;
    error?: string;
  }> {
    const method = 'getAccessToken';
    try {
      logInfo('stripeService', method, 'Exchanging OAuth code for token');

      const response = await fetch('https://connect.stripe.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_secret: config.stripe.clientSecret || '',
          code,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const data = (await response.json()) as any;

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      logInfo('stripeService', method, '✅ OAuth token received', {
        user_id: data.stripe_user_id,
      });

      return {
        access_token: data.access_token,
        stripe_user_id: data.stripe_user_id,
      };
    } catch (error) {
      logError('stripeService', method, 'OAuth error', error);
      return {
        access_token: '',
        stripe_user_id: '',
        error: (error as Error).message,
      };
    }
  }

  // Connect via OAuth (saves encrypted token)
  async connectViaOAuth(companyId: string, userId: string, code: string): Promise<void> {
    const method = 'connectViaOAuth';
    try {
      logInfo('stripeService', method, 'Starting OAuth connection', { companyId });

      const tokenResult = await this.getAccessToken(code);

      if (tokenResult.error) {
        throw new Error(tokenResult.error);
      }

      // Encrypt and save token
      const encrypted = encryptField(tokenResult.access_token);

      await CompanyDB.updateCompany(companyId, {
        stripe_api_key_encrypted: encrypted,
        stripe_account_id: tokenResult.stripe_user_id,
      });

      await AuditDB.createAuditLog({
        companyId,
        userId,
        action: 'CONNECT_OAUTH',
        resourceType: 'integration',
        details: { integration: 'stripe', oauthUserId: tokenResult.stripe_user_id },
      });

      logInfo('stripeService', method, '✅ OAuth connection successful', {
        companyId,
        stripeUserId: tokenResult.stripe_user_id,
      });
    } catch (error) {
      logError('stripeService', method, 'OAuth connection failed', error, { companyId });
      throw error;
    }
  }
}

export const stripeService = new StripeService();
