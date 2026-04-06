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
  changePassword,
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
import { loginSchema, signupSchema } from '../types/schemas';
import { authLimiter, publicFormLimiter } from '../middleware/rateLimiter';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// Public routes
// Bootstrap: only works on empty DB (first admin setup)
router.post('/bootstrap', validate(signupSchema), bootstrap);

// Signup with email/password
router.post('/signup', publicFormLimiter, validate(signupSchema), signup);

// Onboarding with invite token (Motion 1 - Personalized invites)
router.post('/onboard-with-token', publicFormLimiter, validate(signupSchema), onboardWithToken);
router.post('/onboard/company-info', authMiddleware, demoBlocker, completeCompanyForm);

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/change-password', authMiddleware, demoBlocker, changePassword);
router.post("/verify-email", publicFormLimiter, verifyEmail);
router.get('/oauth/google/callback', googleCallback);
router.post('/oauth/google/callback', googleCallback);

// Public/Protected routes
router.post('/resend-otp', resendOtp);  // Can work with auth OR email param
router.get('/me', authMiddleware, me);
router.get('/sessions', authMiddleware, listSessions);
router.delete('/sessions/:sessionId', authMiddleware, demoBlocker, revokeSessionById);
router.post('/sessions/revoke-all', authMiddleware, demoBlocker, revokeAllSessions);
router.get('/sessions/company', authMiddleware, demoBlocker, requireRole('admin'), listCompanySessions);
router.delete('/sessions/company/:sessionId', authMiddleware, demoBlocker, requireRole('admin'), revokeCompanySessionById);

export default router;
