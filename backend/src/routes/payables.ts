import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  listPayables,
  getPayablesSummary,
  createPayable,
  updatePayable,
  deletePayable,
} from '../controllers/payablesController';

const router = Router();

// All payables routes require auth
router.use(authMiddleware);
router.use(tenantScopeGuard);

// List all payables for company
router.get('/', listPayables);

// Get payables summary (grouped by time buckets)
router.get('/summary', getPayablesSummary);

// Create new payable
router.post('/', createPayable);

// Update payable
router.put('/:id', updatePayable);

// Delete payable
router.delete('/:id', deletePayable);

export default router;
