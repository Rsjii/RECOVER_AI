import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  generateInviteToken,
  getInviteInfo,
  validateToken,
  listInvites,
} from '../controllers/inviteController';

const router = Router();

/**
 * Admin endpoints (require authentication + admin role)
 */

// POST /api/invites/generate - Admin only: Generate personalized invite token
// Only accepts: email (optional), company_name (required)
// Does NOT accept: revenue, employees, or research_data
router.post('/generate', authMiddleware, requireRole('admin'), generateInviteToken);

// GET /api/invites/list - Admin only: List all invite tokens created by this admin
router.get('/list', authMiddleware, requireRole('admin'), listInvites);

/**
 * Public endpoints (no auth required, for frontend)
 */

// GET /api/invites/:token - Get invite info (validate token, return metadata)
router.get('/:token', getInviteInfo);

// POST /api/invites/validate - Validate token + email combo
router.post('/validate', validateToken);

export default router;
