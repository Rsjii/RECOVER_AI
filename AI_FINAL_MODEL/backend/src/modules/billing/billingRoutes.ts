import { Router } from 'express';
import * as ctrl from './billingController';
import { requireAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

router.get('/plan',          requireAuth,              ctrl.getPlan);
router.get('/checkout-urls', requireAuth, requireAdmin, ctrl.getCheckoutUrls);
router.get('/portal',        requireAuth, requireAdmin, ctrl.getPortalUrl);
router.post('/webhook', ctrl.handleWebhook);

export default router;
