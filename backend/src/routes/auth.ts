import { Router } from 'express';
import {
  signup,
  login,
  logout,
  refresh,
  me,
  googleCallback,
  forgotPassword,
  resetPassword,
  listSessions,
  listCompanySessions,
  revokeCompanySessionById,
  revokeSessionById,
  revokeAllSessions,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { signupSchema, loginSchema } from '../types/schemas';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.post('/signup', authLimiter, validate(signupSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/oauth/google/callback', googleCallback);

// Protected routes
router.get('/me', authMiddleware, me);
router.get('/sessions', authMiddleware, listSessions);
router.delete('/sessions/:sessionId', authMiddleware, revokeSessionById);
router.post('/sessions/revoke-all', authMiddleware, revokeAllSessions);
router.get('/sessions/company', authMiddleware, requireRole('admin'), listCompanySessions);
router.delete('/sessions/company/:sessionId', authMiddleware, requireRole('admin'), revokeCompanySessionById);

export default router;
