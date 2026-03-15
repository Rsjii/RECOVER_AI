import { Router } from 'express';
import { demoLogin, demoPreview } from '../controllers/demoController';
import { demoLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/demo/login
 * Creates complete demo environment with test data
 * No authentication required
 * Rate limited to prevent abuse:
 * - Dev: 10000 per minute (essentially unlimited)
 * - Prod: 5 per minute
 */
router.post('/login', demoLimiter, demoLogin);

/**
 * POST /api/demo/preview
 * Dry-run agent on demo data — returns what WOULD happen (no emails sent).
 * Call after /api/demo/login to show safe preview to prospects.
 */
router.post('/preview', demoLimiter, demoPreview);

export default router;
