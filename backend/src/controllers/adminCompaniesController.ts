import { Request, Response } from 'express';
import {
  getAdminCompanyList,
  getAdminCompanyDetail,
  getAdminCompanyUsers,
  getAdminCompanyInvoiceSummary,
  getAdminCompanyEmailSummary,
  getAdminCompanyStripeAccounts,
  getAdminCompanyActivity,
  updateAdminCompany,
} from '../db/adminCompanies';
import { getArHealth, getCompanyCustomers, getCompanyInvoicesDetailed } from '../db/adminArHealth';
import { getCompanyUsage, getCompanyUsageSummary, getCompanyUsageByModel } from '../db/adminUsage';
import { getInfrastructureStats, getEndpointPerformance } from '../db/adminInfra';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'adminCompaniesController';

/**
 * GET /api/admin/companies
 * List all companies with aggregated stats
 */
export const listCompanies = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listCompanies';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || undefined;
    const accountType = (req.query.accountType as string) || undefined;

    const { companies, total } = await getAdminCompanyList({
      limit,
      offset,
      search,
      accountType,
    });

    logInfo(LOG_MODULE, handler, 'Companies listed', { total, returned: companies.length });

    res.json({
      data: companies,
      pagination: { limit, offset, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id
 * Get company detail
 */
export const getCompanyDetail = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyDetail';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const detail = await getAdminCompanyDetail(companyId);

    if (!detail) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    logInfo(LOG_MODULE, handler, 'Company detail fetched', { companyId });
    res.json({ data: detail });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/users
 * Get company users
 */
export const getCompanyUsers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyUsers';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const users = await getAdminCompanyUsers(companyId);

    logInfo(LOG_MODULE, handler, 'Company users fetched', { companyId, count: users.length });
    res.json({ data: users });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/invoices
 * Get company invoice summary
 */
export const getCompanyInvoices = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyInvoices';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const summary = await getAdminCompanyInvoiceSummary(companyId);

    logInfo(LOG_MODULE, handler, 'Company invoice summary fetched', { companyId });
    res.json({ data: summary });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/emails
 * Get company email sending summary
 */
export const getCompanyEmails = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyEmails';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const summary = await getAdminCompanyEmailSummary(companyId);

    logInfo(LOG_MODULE, handler, 'Company email summary fetched', { companyId });
    res.json({ data: summary });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/stripe
 * Get company Stripe accounts
 */
export const getCompanyStripe = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyStripe';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const accounts = await getAdminCompanyStripeAccounts(companyId);

    logInfo(LOG_MODULE, handler, 'Company Stripe accounts fetched', { companyId, count: accounts.length });
    res.json({ data: accounts });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/activity
 * Get company activity logs
 */
export const getCompanyActivity = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyActivity';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const logs = await getAdminCompanyActivity(companyId, limit);

    logInfo(LOG_MODULE, handler, 'Company activity fetched', { companyId, count: logs.length });
    res.json({ data: logs });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/admin/companies/:id
 * Update company settings (admin override)
 */
export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateCompany';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { account_type, billing_tier, trial_status, trial_ends_at } = req.body;

    await updateAdminCompany(companyId, {
      account_type,
      billing_tier,
      trial_status,
      trial_ends_at,
    });

    logInfo(LOG_MODULE, handler, 'Company updated', { companyId, updates: Object.keys(req.body) });
    res.json({ success: true, message: 'Company updated' });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/ar-health
 * Get company AR health metrics
 */
export const getCompanyArHealth = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyArHealth';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const arHealth = await getArHealth(companyId);

    logInfo(LOG_MODULE, handler, 'AR health fetched', { companyId });
    res.json({ data: arHealth });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/customers
 * Get company customers with AR details
 */
export const getCompanyCustomersList = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyCustomersList';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || undefined;

    const customers = await getCompanyCustomers(companyId, { limit, offset, search });

    logInfo(LOG_MODULE, handler, 'Customers fetched', { companyId, count: customers.length });
    res.json({ data: customers, pagination: { limit, offset, returned: customers.length } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/invoices-detail
 * Get company invoices with aging
 */
export const getCompanyInvoicesList = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyInvoicesList';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = (req.query.status as string) || undefined;

    const invoices = await getCompanyInvoicesDetailed(companyId, { limit, offset, status });

    logInfo(LOG_MODULE, handler, 'Invoices fetched', { companyId, count: invoices.length });
    res.json({ data: invoices, pagination: { limit, offset, returned: invoices.length } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/companies/:id/usage
 * Get company API usage and costs
 */
export const getCompanyUsageData = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCompanyUsageData';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const companyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [usage, summary, byModel] = await Promise.all([
      getCompanyUsage(companyId, 12),
      getCompanyUsageSummary(companyId),
      getCompanyUsageByModel(companyId),
    ]);

    logInfo(LOG_MODULE, handler, 'Usage fetched', { companyId });
    res.json({ data: { usage, summary, byModel } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/infrastructure
 * Get platform infrastructure stats
 */
export const getInfraStats = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getInfraStats';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    if (!config.admin.emails.includes(userEmail)) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const [stats, endpoints] = await Promise.all([
      getInfrastructureStats(),
      getEndpointPerformance(20),
    ]);

    logInfo(LOG_MODULE, handler, 'Infrastructure stats fetched');
    res.json({ data: { stats, endpoints } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};
