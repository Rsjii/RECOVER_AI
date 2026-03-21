import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getCampaignAnalytics, getAgingDetail, getPaymentPlansDetail, getKpiTrends } from '../controllers/reportsController';

const router = Router();
router.use(authMiddleware);

router.get('/campaign-analytics', getCampaignAnalytics);
router.get('/aging-detail', getAgingDetail);
router.get('/payment-plans-detail', getPaymentPlansDetail);
router.get('/kpi-trends', getKpiTrends);

export default router;
