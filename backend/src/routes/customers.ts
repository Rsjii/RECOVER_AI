import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { listCustomers, getAllCustomerIds, getCustomer, updateCustomer, unsubscribeCustomer, batchDeleteCustomers, createCustomer, importCustomersCSV } from '../controllers/customerController';

const router = Router();

// Public route — no auth (customer clicking unsubscribe from email)
router.post('/unsubscribe', unsubscribeCustomer);

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', listCustomers);
router.get('/all-ids', getAllCustomerIds);
router.post('/', createCustomer);
router.post('/import-csv', importCustomersCSV);
router.post('/bulk-delete', batchDeleteCustomers);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);

export default router;
