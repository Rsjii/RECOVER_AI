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
  verifyEmail,
  resendOtp,
  listSessions,
  listCompanySessions,
  revokeCompanySessionById,
  revokeSessionById,
  revokeAllSessions,
  bootstrap,
  onboardWithToken,
  completeCompanyForm,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { loginSchema } from '../types/schemas';
import { authLimiter, publicFormLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
// Bootstrap: only works on empty DB (first admin setup)
router.post('/bootstrap', bootstrap);

// Signup & Login
router.post('/signup', publicFormLimiter, signup);  // ✅ Creates account + sends OTP
router.post('/login', authLimiter, validate(loginSchema), login);

// Onboarding with invite token (Motion 1 - Personalized invites)
router.post('/onboard-with-token', publicFormLimiter, onboardWithToken);
router.post('/onboard/company-info', authMiddleware, completeCompanyForm);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/verify-email', publicFormLimiter, verifyEmail);  // ✅ PUBLIC route, no auth needed
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
