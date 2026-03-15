import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import * as ctrl from './apiKeysController';

const router = Router();
router.get('/',          requireAuth, requireAdmin, ctrl.listApiKeys);
router.post('/',         requireAuth, requireAdmin, ctrl.createApiKey);
router.delete('/:keyId', requireAuth, requireAdmin, ctrl.revokeApiKey);
export default router;
