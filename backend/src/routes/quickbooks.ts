import { Router } from 'express';
import { qbOAuthAuthorize, qbOAuthCallback, syncQBInvoices, disconnectQB } from '../controllers/quickbooksController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// OAuth flow (authorize redirects browser, callback is from QB)
router.get('/oauth/authorize', authMiddleware, demoBlocker, qbOAuthAuthorize);
router.get('/oauth/callback', qbOAuthCallback);

// Protected routes
router.post('/sync', authMiddleware, demoBlocker, syncQBInvoices);
router.delete('/disconnect', authMiddleware, demoBlocker, disconnectQB);

export default router;
