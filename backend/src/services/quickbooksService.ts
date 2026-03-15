import * as CompanyDB from '../db/companies';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import * as AuditDB from '../db/auditLogs';
import { encryptField, decryptField } from '../lib/encryption';
import { logError, logInfo } from '../utils/logger';
import { config } from '../config/env';

const QB_BASE_URL = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

const QB_AUTH_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

function getBaseUrl(): string {
  const env = config.quickbooks?.environment || 'sandbox';
  return QB_BASE_URL[env as 'sandbox' | 'production'];
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = config.quickbooks?.clientId || '';
  const clientSecret = config.quickbooks?.clientSecret || '';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QB_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`QB token exchange failed: ${err}`);
  }

  return response.json() as Promise<any>;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const clientId = config.quickbooks?.clientId || '';
  const clientSecret = config.quickbooks?.clientSecret || '';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QB_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`QB token refresh failed: ${err}`);
  }

  return response.json() as Promise<any>;
}

async function getAccessToken(companyId: string): Promise<{ accessToken: string; realmId: string }> {
  const company = await CompanyDB.findCompanyById(companyId);
  if (!company?.quickbooks_access_token_encrypted || !company?.quickbooks_realm_id) {
    throw new Error('QuickBooks not connected for this company');
  }

  return {
    accessToken: decryptField(company.quickbooks_access_token_encrypted),
    realmId: company.quickbooks_realm_id,
  };
}

class QuickBooksService {
  getOAuthUrl(companyId: string, redirectUri: string): string {
    const clientId = config.quickbooks?.clientId || '';
    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: redirectUri,
      response_type: 'code',
      state: companyId,
    });
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  async handleOAuthCallback(
    companyId: string,
    userId: string,
    code: string,
    realmId: string,
    redirectUri: string
  ): Promise<void> {
    const method = 'handleOAuthCallback';
    try {
      logInfo('quickbooksService', method, 'Exchanging QB OAuth code', { companyId, realmId });

      const tokens = await exchangeCodeForTokens(code, redirectUri);

      await CompanyDB.updateCompany(companyId, {
        quickbooks_realm_id: realmId,
        quickbooks_access_token_encrypted: encryptField(tokens.access_token),
        quickbooks_refresh_token_encrypted: encryptField(tokens.refresh_token),
      });

      await AuditDB.createAuditLog({
        companyId,
        userId,
        action: 'CONNECT',
        resourceType: 'integration',
        details: { integration: 'quickbooks', realmId },
      });

      logInfo('quickbooksService', method, 'QB connected successfully', { companyId, realmId });
    } catch (error) {
      logError('quickbooksService', method, 'QB OAuth callback failed', error, { companyId });
      throw error;
    }
  }

  async syncInvoices(companyId: string): Promise<{ created: number; updated: number; skipped: number }> {
    const method = 'syncInvoices';
    const startTime = Date.now();
    try {
      logInfo('quickbooksService', method, 'Starting QB invoice sync', { companyId });

      let { accessToken, realmId } = await getAccessToken(companyId);

      // Try to sync; if 401, refresh token and retry once
      let invoices = await this.fetchQBInvoices(accessToken, realmId);
      if (invoices === null) {
        // Token expired — refresh
        const company = await CompanyDB.findCompanyById(companyId);
        if (!company?.quickbooks_refresh_token_encrypted) throw new Error('QB refresh token missing');
        const refreshToken = decryptField(company.quickbooks_refresh_token_encrypted);
        const newTokens = await refreshAccessToken(refreshToken);

        await CompanyDB.updateCompany(companyId, {
          quickbooks_access_token_encrypted: encryptField(newTokens.access_token),
          quickbooks_refresh_token_encrypted: encryptField(newTokens.refresh_token),
        });

        accessToken = newTokens.access_token;
        invoices = await this.fetchQBInvoices(accessToken, realmId);
        if (invoices === null) throw new Error('QB API failed after token refresh');
      }

      const result = { created: 0, updated: 0, skipped: 0 };

      for (const qbInv of invoices) {
        // Skip if no customer email
        const email = qbInv.BillEmail?.Address || qbInv.CustomerRef?.name;
        if (!email || !email.includes('@')) {
          result.skipped++;
          continue;
        }

        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: qbInv.CustomerRef?.name || email,
          email,
        });

        const amount = parseFloat(qbInv.Balance || qbInv.TotalAmt || '0');
        if (amount <= 0) { result.skipped++; continue; }

        const dueDate = qbInv.DueDate ? new Date(qbInv.DueDate) : new Date();
        const issuedDate = qbInv.TxnDate ? new Date(qbInv.TxnDate) : new Date();

        const { isNew } = await InvoiceDB.upsertInvoice({
          companyId,
          customerId: customer.id,
          amount,
          currency: 'USD',
          dueDate,
          issuedDate,
          source: 'quickbooks',
          sourceId: qbInv.Id,
        });

        isNew ? result.created++ : result.updated++;
      }

      logInfo('quickbooksService', method, 'QB sync completed', {
        companyId,
        elapsedMs: Date.now() - startTime,
        ...result,
      });
      return result;
    } catch (error) {
      logError('quickbooksService', method, 'QB sync failed', error, { companyId });
      throw error;
    }
  }

  private async fetchQBInvoices(accessToken: string, realmId: string): Promise<any[] | null> {
    const baseUrl = getBaseUrl();
    const query = "SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 200";
    const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 401) return null; // Token expired

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`QB API error: ${err}`);
    }

    const data = (await response.json()) as any;
    return data?.QueryResponse?.Invoice || [];
  }

  async disconnect(companyId: string, userId: string): Promise<void> {
    await CompanyDB.updateCompany(companyId, {
      quickbooks_realm_id: null,
      quickbooks_access_token_encrypted: null,
      quickbooks_refresh_token_encrypted: null,
    });

    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'DISCONNECT',
      resourceType: 'integration',
      details: { integration: 'quickbooks' },
    });
  }

  isConnected(company: { quickbooks_realm_id?: string | null; quickbooks_access_token_encrypted?: string | null }): boolean {
    return !!(company.quickbooks_realm_id && company.quickbooks_access_token_encrypted);
  }
}

export const quickbooksService = new QuickBooksService();
