import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { getWeeklyReports, getWeeklyReportById, previewWeeklyReport } from './reportsController';

const router = Router();

router.get('/weekly',         requireAuth, getWeeklyReports);
router.get('/weekly/:id',     requireAuth, getWeeklyReportById);
router.post('/weekly/preview', requireAuth, requireAdmin, previewWeeklyReport);

export default router;
