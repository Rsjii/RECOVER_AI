import { Router } from 'express';
import { qbOAuthAuthorize, qbOAuthCallback, syncQBInvoices, disconnectQB } from '../controllers/quickbooksController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// OAuth flow (authorize redirects browser, callback is from QB)
router.get('/oauth/authorize', authMiddleware, qbOAuthAuthorize);
router.get('/oauth/callback', qbOAuthCallback);

// Protected routes
router.post('/sync', authMiddleware, syncQBInvoices);
router.delete('/disconnect', authMiddleware, disconnectQB);

export default router;
