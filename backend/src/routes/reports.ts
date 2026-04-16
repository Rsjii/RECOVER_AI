import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getCampaignAnalytics, getAgingDetail, getKpiTrends } from '../controllers/reportsController';
// import { getPaymentPlansDetail } from '../controllers/reportsController';  // ❌ DISABLED: PHASE 2 feature

const router = Router();
router.use(authMiddleware);

router.get('/campaign-analytics', getCampaignAnalytics);
router.get('/aging-detail', getAgingDetail);
// router.get('/payment-plans-detail', getPaymentPlansDetail);  // ❌ DISABLED: PHASE 2 feature
router.get('/kpi-trends', getKpiTrends);

export default router;
