import * as CompanyDB from '../db/companies';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import * as AuditDB from '../db/auditLogs';
import { encryptField, decryptField } from '../lib/encryption';
import { logError, logInfo } from '../utils/logger';

async function callChargebeeApi(site: string, apiKey: string, path: string): Promise<any> {
  const url = `https://${site}.chargebee.com/api/v2${path}`;
  const credentials = Buffer.from(`${apiKey}:`).toString('base64');

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chargebee API error (${response.status}): ${err}`);
  }

  return response.json();
}

class ChargebeeService {
  async connect(companyId: string, userId: string, site: string, apiKey: string): Promise<void> {
    const method = 'connect';
    try {
      logInfo('chargebeeService', method, 'Validating Chargebee credentials', { companyId, site });

      // Validate by fetching subscriptions list
      await callChargebeeApi(site, apiKey, '/subscriptions?limit=1');

      await CompanyDB.updateCompany(companyId, {
        chargebee_site: site,
        chargebee_api_key_encrypted: encryptField(apiKey),
      });

      await AuditDB.createAuditLog({
        companyId,
        userId,
        action: 'CONNECT',
        resourceType: 'integration',
        details: { integration: 'chargebee', site },
      });

      logInfo('chargebeeService', method, 'Chargebee connected', { companyId, site });
    } catch (error) {
      logError('chargebeeService', method, 'Connect failed', error, { companyId });
      throw error;
    }
  }

  async syncInvoices(companyId: string): Promise<{ created: number; updated: number; skipped: number }> {
    const method = 'syncInvoices';
    const startTime = Date.now();
    try {
      logInfo('chargebeeService', method, 'Starting Chargebee sync', { companyId });

      const company = await CompanyDB.findCompanyById(companyId);
      if (!company?.chargebee_site || !company?.chargebee_api_key_encrypted) {
        throw new Error('Chargebee not connected for this company');
      }

      const site = company.chargebee_site;
      const apiKey = decryptField(company.chargebee_api_key_encrypted);

      const result = { created: 0, updated: 0, skipped: 0 };

      // Fetch unpaid invoices from Chargebee
      let offset: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({ limit: '100', 'status[is]': 'payment_due' });
        if (offset) params.append('offset', offset);

        const data = await callChargebeeApi(site, apiKey, `/invoices?${params.toString()}`);
        const invoices: any[] = data.list || [];

        for (const entry of invoices) {
          const inv = entry.invoice;
          if (!inv) { result.skipped++; continue; }

          const email = inv.billing_address?.email || inv.customer_id;
          if (!email || !email.includes('@')) { result.skipped++; continue; }

          const amount = (inv.amount_due || 0) / 100;
          if (amount <= 0) { result.skipped++; continue; }

          const customer = await CustomerDB.findOrCreateCustomer({
            companyId,
            name: inv.billing_address?.first_name
              ? `${inv.billing_address.first_name} ${inv.billing_address.last_name || ''}`.trim()
              : email,
            email,
          });

          const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : new Date();
          const issuedDate = inv.date ? new Date(inv.date * 1000) : new Date();

          const { isNew } = await InvoiceDB.upsertInvoice({
            companyId,
            customerId: customer.id,
            amount,
            currency: (inv.currency_code || 'USD').toUpperCase(),
            dueDate,
            issuedDate,
            source: 'chargebee',
            sourceId: inv.id,
          });

          isNew ? result.created++ : result.updated++;
        }

        if (data.next_offset) {
          offset = data.next_offset;
        } else {
          hasMore = false;
        }
      }

      logInfo('chargebeeService', method, 'Chargebee sync completed', {
        companyId,
        elapsedMs: Date.now() - startTime,
        ...result,
      });
      return result;
    } catch (error) {
      logError('chargebeeService', method, 'Chargebee sync failed', error, { companyId });
      throw error;
    }
  }

  async handleWebhook(companyId: string, eventType: string, content: any): Promise<void> {
    const method = 'handleWebhook';
    try {
      logInfo('chargebeeService', method, 'Processing Chargebee webhook', { companyId, eventType });

      if (eventType === 'invoice_generated' || eventType === 'payment_failed') {
        const inv = content?.invoice;
        if (!inv) return;

        const email = inv.billing_address?.email || inv.customer_id;
        if (!email || !email.includes('@')) return;

        const amount = (inv.amount_due || 0) / 100;
        if (amount <= 0) return;

        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: email,
          email,
        });

        await InvoiceDB.upsertInvoice({
          companyId,
          customerId: customer.id,
          amount,
          currency: (inv.currency_code || 'USD').toUpperCase(),
          dueDate: inv.due_date ? new Date(inv.due_date * 1000) : new Date(),
          issuedDate: inv.date ? new Date(inv.date * 1000) : new Date(),
          source: 'chargebee',
          sourceId: inv.id,
        });
      }

      if (eventType === 'payment_succeeded') {
        const payment = content?.payment;
        if (!payment?.invoice_id) return;

        const invoice = await InvoiceDB.findInvoiceBySourceId(payment.invoice_id, 'chargebee', companyId);
        if (invoice) {
          await InvoiceDB.updateInvoiceStatus(invoice.id, companyId, 'paid');
        }
      }
    } catch (error) {
      logError('chargebeeService', method, 'Webhook processing failed', error);
      throw error;
    }
  }

  async disconnect(companyId: string, userId: string): Promise<void> {
    await CompanyDB.updateCompany(companyId, {
      chargebee_site: null,
      chargebee_api_key_encrypted: null,
    });

    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'DISCONNECT',
      resourceType: 'integration',
      details: { integration: 'chargebee' },
    });
  }
}

export const chargebeeService = new ChargebeeService();
