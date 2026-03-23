import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { getAnalytics, getInvoiceAnalysis } from '../controllers/declineCodeController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/analytics', getAnalytics);
router.get('/invoices/:id', getInvoiceAnalysis);

export default router;
