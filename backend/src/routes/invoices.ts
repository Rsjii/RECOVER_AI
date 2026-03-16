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
  getDunningStatus,
  pauseInvoiceDunning,
  resumeInvoiceDunning,
  stopInvoiceDunning,
} from '../controllers/invoiceController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', listInvoices);
router.get('/:id/detail', getInvoiceDetail);
router.get('/:id/dunning-status', getDunningStatus);
router.get('/:id', getInvoice);
router.post('/manual', createManualInvoice);
router.post('/csv-upload', uploadCSVFile);
router.post('/upload-csv', uploadCSV);
router.put('/:id/status', updateInvoiceStatus);
router.post('/:id/dunning/pause', pauseInvoiceDunning);
router.post('/:id/dunning/resume', resumeInvoiceDunning);
router.delete('/:id/dunning', stopInvoiceDunning);

export default router;
