import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  getAssumptions,
  createOrUpdateAssumptions,
  updateAssumptions,
} from '../controllers/forecastAssumptionsController';

const router = Router();

// All routes require auth
router.use(authMiddleware);
router.use(tenantScopeGuard);

// Get assumptions (or create defaults)
router.get('/', getAssumptions);

// Create or update assumptions
router.post('/', createOrUpdateAssumptions);

// Update specific assumptions by ID
router.put('/:id', updateAssumptions);

export default router;
