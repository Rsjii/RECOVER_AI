import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import * as AuditInvitesDB from '../db/auditInvites';
import * as AuditRequestsDB from '../db/auditRequests';
import resendService from '../services/resendService';

const MODULE = 'requestsController';

/**
 * Submit an audit request from the website form
 * POST /api/audit-requests
 * Body: { company_name, email, revenue?, phone? }
 */
export const submitAuditRequest = async (req: Request, res: Response) => {
  const { company_name, email } = req.body as {
    company_name: string;
    email: string;
  };

  try {
    // 1. Validate input
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length === 0) {
      return res.status(400).json({ error: 'Company name required' });
    }

    logInfo(MODULE, 'submitAuditRequest', `New request from ${email}`, { company: company_name });

    // 2. Create audit invite (auto-generated from website form)
    const invite = await AuditInvitesDB.createAuditInvite({
      email: email,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdByType: 'website',
    });

    // 3. Create audit request record
    const request = await AuditRequestsDB.createAuditRequest({
      token: invite.token,
      companyName: company_name,
      email: email,
    });

    logInfo(MODULE, 'submitAuditRequest', 'Request created (pending approval)', {
      token: invite.token.slice(0, 8),
      email,
      company: company_name
    });

    // 4. Return success message (NO EMAIL YET - waiting for admin approval)
    return res.json({
      message: 'Thanks for your interest! We\'ll review and send you the link within 24 hours.',
      request_id: request.id,
    });
  } catch (err: any) {
    logError(MODULE, 'submitAuditRequest', 'Failed to submit request', err);
    return res.status(400).json({ error: err.message || 'Failed to submit request' });
  }
};

/**
 * Get admin audit requests dashboard
 * GET /api/admin/audit-requests?status=pending
 */
export const listAuditRequests = async (req: Request, res: Response) => {
  const status = (req.query.status || 'pending') as string;
  const limit = parseInt((req.query.limit || '50') as string);
  const offset = parseInt((req.query.offset || '0') as string);

  try {
    const requests = await AuditRequestsDB.listAuditRequests({
      status,
      limit,
      offset,
    });

    const stats = await AuditRequestsDB.getAuditRequestStats();

    return res.json({
      data: requests,
      stats: stats,
    });
  } catch (err: any) {
    logError(MODULE, 'listAuditRequests', 'Failed to list requests', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Get a single audit request
 * GET /api/admin/audit-requests/:email
 */
export const getAuditRequest = async (req: Request, res: Response) => {
  const { email } = req.params as { email: string };

  try {
    const request = await AuditRequestsDB.getAuditRequest(email);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.json({ data: request });
  } catch (err: any) {
    logError(MODULE, 'getAuditRequest', 'Failed to get request', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Approve an audit request (sends them the invite link)
 * POST /api/admin/audit-requests/:email/approve
 */
export const approveAuditRequest = async (req: Request, res: Response) => {
  const { email } = req.params as { email: string };

  try {
    // Get the request
    const request = await AuditRequestsDB.getAuditRequest(email);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get audit invite (to get the link)
    const auditInvite = await AuditInvitesDB.getAuditInvite(request.token);
    if (!auditInvite) {
      return res.status(400).json({ error: 'Invite token not found' });
    }

    // Send invite email to prospect
    const link = `${process.env.FRONTEND_URL || 'https://recoverai.com'}/audit?invite=${request.token}`;

    try {
      const subject = '🎯 Your RecoverAI AR Analysis Link';
      const bodyText = `
Hi ${request.company_name},

Thanks for requesting an AR analysis. Click below to see how much working capital you can free up in 90 days.

${link}

This link expires in 7 days.

Questions? Reply to this email.

Best,
RecoverAI Team
      `.trim();

      const bodyHtml = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2>🎯 Your RecoverAI AR Analysis</h2>
  <p>Hi ${request.company_name},</p>
  <p>We've approved your request! Click below to analyze your AR and see your custom recovery opportunity.</p>
  <p>
    <a href="${link}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
      Start Your Analysis
    </a>
  </p>
  <p style="margin-top: 20px; font-size: 14px; color: #666;">
    This link expires in 7 days. No credit card required.
  </p>
  <p style="font-size: 12px; color: #999;">
    RecoverAI • Autonomous AR Recovery for SaaS
  </p>
</body>
</html>
      `;

      await resendService.sendEmail({
        to: email,
        subject,
        bodyText,
        bodyHtml,
      });

      logInfo(MODULE, 'approveAuditRequest', 'Invite email sent', { email });
    } catch (emailErr: any) {
      logError(MODULE, 'approveAuditRequest', 'Failed to send email', emailErr);
      // Still mark as approved even if email fails
    }

    // Update status
    await AuditRequestsDB.updateAuditRequestStatus(email, 'approved');

    logInfo(MODULE, 'approveAuditRequest', `Approved and emailed audit link to ${email}`);

    return res.json({
      message: 'Request approved and link sent via email',
      data: request,
    });
  } catch (err: any) {
    logError(MODULE, 'approveAuditRequest', 'Failed to approve request', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Reject an audit request
 * POST /api/admin/audit-requests/:email/reject
 */
export const rejectAuditRequest = async (req: Request, res: Response) => {
  const { email } = req.params as { email: string };
  const { reason } = req.body as { reason?: string };

  try {
    // Update status
    await AuditRequestsDB.updateAuditRequestStatus(email, 'rejected');

    logInfo(MODULE, 'rejectAuditRequest', `Rejected request for ${email}`, { reason });

    return res.json({
      message: 'Request rejected',
    });
  } catch (err: any) {
    logError(MODULE, 'rejectAuditRequest', 'Failed to reject request', err);
    return res.status(400).json({ error: err.message });
  }
};
