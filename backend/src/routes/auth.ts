import { Router } from 'express';
import {
  login,
  logout,
  refresh,
  me,
  googleCallback,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendOtp,
  listSessions,
  listCompanySessions,
  revokeCompanySessionById,
  revokeSessionById,
  revokeAllSessions,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { loginSchema } from '../types/schemas';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
// Signup disabled - pilots only apply via /api/pilots/request
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/verify-email', authMiddleware, verifyEmail);
router.post('/oauth/google/callback', googleCallback);

// Public/Protected routes
router.post('/resend-otp', resendOtp);  // Can work with auth OR email param
router.get('/me', authMiddleware, me);
router.get('/sessions', authMiddleware, listSessions);
router.delete('/sessions/:sessionId', authMiddleware, revokeSessionById);
router.post('/sessions/revoke-all', authMiddleware, revokeAllSessions);
router.get('/sessions/company', authMiddleware, requireRole('admin'), listCompanySessions);
router.delete('/sessions/company/:sessionId', authMiddleware, requireRole('admin'), revokeCompanySessionById);

export default router;
