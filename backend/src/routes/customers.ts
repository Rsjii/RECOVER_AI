import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { listCustomers, getCustomer, updateCustomer, unsubscribeCustomer, batchDeleteCustomers, createCustomer } from '../controllers/customerController';

const router = Router();

// Public route — no auth (customer clicking unsubscribe from email)
router.post('/unsubscribe', unsubscribeCustomer);

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', listCustomers);
router.post('/', createCustomer);
router.post('/bulk-delete', batchDeleteCustomers);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);

export default router;
