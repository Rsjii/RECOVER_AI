import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  checkAdminAccess,
  getMetrics,
  getEmailLogs,
  getUsers,
  getActivityLogsHandler,
  getBillingHandler,
  getIntegrationsHandler,
  getSecurityHandler,
  getPerformanceHandler,
} from '../controllers/adminController';
import {
  listCompanies,
  getCompanyDetail,
  getCompanyUsers,
  getCompanyInvoices,
  getCompanyEmails,
  getCompanyStripe,
  getCompanyActivity,
  updateCompany,
  getCompanyArHealth,
  getCompanyCustomersList,
  getCompanyInvoicesList,
  getCompanyUsageData,
  getInfraStats,
} from '../controllers/adminCompaniesController';

const router = Router();

router.use(authMiddleware);
// NOTE: tenantScopeGuard removed — admin endpoints need cross-tenant access
// Each admin handler validates admin email whitelist separately

// Admin access check (public, no auth needed for frontend to check)
router.get('/check', checkAdminAccess);

// Overview section
router.get('/metrics', getMetrics);

// Operations section
router.get('/email-logs', getEmailLogs);
router.get('/activity-logs', getActivityLogsHandler);

// Companies section (new hyper-detailed view)
router.get('/companies', listCompanies);
router.get('/companies/:id', getCompanyDetail);
router.get('/companies/:id/users', getCompanyUsers);
router.get('/companies/:id/invoices', getCompanyInvoices);
router.get('/companies/:id/invoices-detail', getCompanyInvoicesList);
router.get('/companies/:id/emails', getCompanyEmails);
router.get('/companies/:id/stripe', getCompanyStripe);
router.get('/companies/:id/activity', getCompanyActivity);
router.get('/companies/:id/ar-health', getCompanyArHealth);
router.get('/companies/:id/customers', getCompanyCustomersList);
router.get('/companies/:id/usage', getCompanyUsageData);
router.patch('/companies/:id', updateCompany);

// Infrastructure section
router.get('/infrastructure', getInfraStats);

// System section
router.get('/users', getUsers);
router.get('/billing', getBillingHandler);
router.get('/integrations', getIntegrationsHandler);
router.get('/security', getSecurityHandler);
router.get('/performance', getPerformanceHandler);

export default router;
