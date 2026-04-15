import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import {
  listInvoices,
  exportInvoicesCSV,
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
  getCSVImportStatusHandler,
  deleteInvoice,
  getAllInvoiceIds,
  batchDeleteInvoices,
  getBatchDeleteStatus,
  getWorkflowTimeline,
  getPaymentLink,
} from '../controllers/invoiceController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);  // Block mutations for demo users (after auth is set)

router.get('/', listInvoices);
router.get('/all-ids', getAllInvoiceIds);
router.get('/export', exportInvoicesCSV);
router.get('/csv-import-status/:jobId', getCSVImportStatusHandler);
router.get('/batch-delete-status/:jobId', getBatchDeleteStatus);
router.get('/:id/detail', getInvoiceDetail);
router.get('/:id/dunning-status', getDunningStatus);
router.get('/:id/workflow-timeline', getWorkflowTimeline);
router.get('/:id/payment-link', getPaymentLink);
router.get('/:id', getInvoice);
router.post('/manual', createManualInvoice);
router.post('/csv-upload', uploadCSVFile);
router.post('/upload-csv', uploadCSV);
router.post('/batch-delete', batchDeleteInvoices);
router.put('/:id/status', updateInvoiceStatus);
router.post('/:id/dunning/pause', pauseInvoiceDunning);
router.post('/:id/dunning/resume', resumeInvoiceDunning);
router.delete('/:id/dunning', stopInvoiceDunning);
router.delete('/:id', deleteInvoice);

export default router;
