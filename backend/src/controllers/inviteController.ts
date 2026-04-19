import { Request, Response } from 'express';
import { createInviteToken, getInviteToken, validateInviteToken, getAdminInviteTokens } from '../db/invites';
import { logInfo, logError } from '../utils/logger';
import { config } from '../config/env';

const MODULE = 'inviteController';

/**
 * Generate personalized invite token for cold outreach (Motion 1)
 * Admin only - you create these to send to founders
 *
 * POST /api/invites/generate
 * Body: { email?: string, company_name: string, company_domain?: string }
 */
export async function generateInviteToken(req: Request, res: Response) {
  try {
    const { email, company_name, company_domain } = req.body;

    // Validation
    if (!company_name || typeof company_name !== 'string') {
      return res.status(400).json({ error: 'company_name is required' });
    }

    if (company_name.trim().length === 0) {
      return res.status(400).json({ error: 'company_name cannot be empty' });
    }

    // email is optional
    const normalized_email = email ? email.toLowerCase().trim() : undefined;

    // company_domain is optional (extracted from email if provided)
    let normalized_domain = company_domain;
    if (!normalized_domain && normalized_email) {
      const domain_match = normalized_email.match(/@(.+)$/);
      if (domain_match) {
        normalized_domain = domain_match[1];
      }
    }

    const user_id = (req as any).userId; // From auth middleware
    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logInfo(MODULE, 'generateInviteToken', 'Creating invite token', {
      email: normalized_email ? '***' : undefined,
      company_name,
      domain: normalized_domain,
    });

    // Create token (7-day expiry)
    const invite = await createInviteToken(
      normalized_email,
      company_name,
      normalized_domain,
      user_id,
      7
    );

    const setup_url = `${config.frontendUrl || 'https://recoverai.com'}/onboard/stage-1?token=${invite.token}${normalized_email ? `&email=${encodeURIComponent(normalized_email)}` : ''}`;

    logInfo(MODULE, 'generateInviteToken', 'Token created', {
      token: invite.token.substring(0, 10) + '...',
      company: company_name,
      expires: invite.expires_at,
    });

    return res.json({
      data: {
        token: invite.token,
        setup_url,
        expires_at: invite.expires_at,
        email_locked: !!normalized_email, // Tell frontend if email is pre-filled/locked
      },
    });
  } catch (err) {
    logError(MODULE, 'generateInviteToken', 'Failed to generate token', err);
    return res.status(500).json({ error: 'Failed to generate invite token' });
  }
}

/**
 * Get invite token info (validate & return metadata)
 * Frontend calls this to check token before showing onboarding form
 *
 * GET /api/invites/:token
 */
export async function getInviteInfo(req: Request, res: Response) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }

    const invite = await getInviteToken(token);

    if (!invite) {
      return res.status(404).json({ error: 'Token invalid or expired' });
    }

    logInfo(MODULE, 'getInviteInfo', 'Token validated', {
      company: invite.company_name,
      has_email: !!invite.email,
    });

    return res.json({
      data: {
        token: invite.token,
        email: invite.email || null,
        company_name: invite.company_name,
        company_domain: invite.company_domain || null,
        expires_at: invite.expires_at,
        is_expired: new Date(invite.expires_at) < new Date(),
        is_used: !!invite.used_at,
        email_locked: !!invite.email, // Tell frontend if email can't be changed
      },
    });
  } catch (err) {
    logError(MODULE, 'getInviteInfo', 'Failed to get token info', err);
    return res.status(500).json({ error: 'Failed to retrieve token info' });
  }
}

/**
 * Validate token + email combination
 * Used internally during signup process
 *
 * POST /api/invites/validate
 * Body: { token: string, email: string }
 */
export async function validateToken(req: Request, res: Response) {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email required' });
    }

    const validation = await validateInviteToken(token, email);

    if (!validation.valid) {
      logInfo(MODULE, 'validateToken', 'Token validation failed', {
        reason: validation.reason,
      });
      return res.status(400).json({ error: validation.reason });
    }

    logInfo(MODULE, 'validateToken', 'Token validated', {
      company: validation.invite?.company_name,
      email: '***',
    });

    return res.json({
      data: {
        valid: true,
        company_name: validation.invite?.company_name,
      },
    });
  } catch (err) {
    logError(MODULE, 'validateToken', 'Token validation error', err);
    return res.status(500).json({ error: 'Validation failed' });
  }
}

/**
 * List all invite tokens (admin only)
 * GET /api/invites/list
 */
export async function listInvites(req: Request, res: Response) {
  try {
    const user_id = (req as any).userId; // From auth middleware

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await getAdminInviteTokens(user_id, 100);

    logInfo(MODULE, 'listInvites', 'Retrieved invite tokens', {
      count: tokens.length,
    });

    return res.json({
      data: tokens,
    });
  } catch (err) {
    logError(MODULE, 'listInvites', 'Failed to list invites', err);
    return res.status(500).json({ error: 'Failed to list invites' });
  }
}
