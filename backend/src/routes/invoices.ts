import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  listInvoices,
  getInvoice,
  getInvoiceDetail,
  createManualInvoice,
  updateInvoiceStatus,
  uploadCSV,
  uploadCSVFile,
} from '../controllers/invoiceController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', listInvoices);
router.get('/:id/detail', getInvoiceDetail);
router.get('/:id', getInvoice);
router.post('/manual', createManualInvoice);
router.post('/csv-upload', uploadCSVFile);
router.post('/upload-csv', uploadCSV);
router.put('/:id/status', updateInvoiceStatus);

export default router;
