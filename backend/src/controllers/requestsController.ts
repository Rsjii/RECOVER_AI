// @ts-nocheck — OLD flow, not mounted in app.ts, kept for reference only
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
 * POST /api/audit-requests/:email/approve
 */
export const approveAuditRequest = async (req: Request, res: Response) => {
  const { email: idOrEmail } = req.params as { email: string };

  try {
    // Support both UUID (new) and email (legacy) lookups
    const isUuid = /^[0-9a-f-]{36}$/.test(idOrEmail);
    const request = isUuid
      ? await AuditRequestsDB.getAuditRequestById(idOrEmail)
      : await AuditRequestsDB.getAuditRequest(idOrEmail);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get audit invite (to verify it exists)
    const auditInvite = await AuditInvitesDB.getAuditInvite(request.token);
    if (!auditInvite) {
      return res.status(400).json({ error: 'Invite token not found' });
    }

    // Update status in DB
    await AuditRequestsDB.updateAuditRequestStatusById(request.id, 'approved');

    // ============================================================
    // EVENT-DRIVEN: Emit event instead of sending email directly
    // This triggers the email listener which queues it immediately
    // Benefit: No blocking I/O, instant response to admin
    // ============================================================
    try {
      const { emitEvent, AppEvent } = await import('../events/eventEmitter');
      emitEvent(AppEvent.AUDIT_APPROVED, {
        email: request.email,
        token: request.token,
        companyName: request.company_name,
      });
      logInfo(MODULE, 'approveAuditRequest', 'Audit approval event emitted', { email: request.email });
    } catch (eventErr: any) {
      logError(MODULE, 'approveAuditRequest', 'Failed to emit event', eventErr);
      // Continue anyway - DB was updated successfully
    }

    logInfo(MODULE, 'approveAuditRequest', 'Audit request approved', { email: request.email });

    return res.json({
      message: 'Request approved. Invite link will be sent shortly.',
      data: request,
    });
  } catch (err: any) {
    logError(MODULE, 'approveAuditRequest', 'Failed to approve request', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Reject an audit request
 * POST /api/audit-requests/:email/reject
 */
export const rejectAuditRequest = async (req: Request, res: Response) => {
  const { email: idOrEmail } = req.params as { email: string };
  const { reason } = req.body as { reason?: string };

  try {
    // Support both UUID (new) and email (legacy) lookups
    const isUuid = /^[0-9a-f-]{36}$/.test(idOrEmail);
    const request = isUuid
      ? await AuditRequestsDB.getAuditRequestById(idOrEmail)
      : await AuditRequestsDB.getAuditRequest(idOrEmail);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Update status by ID
    await AuditRequestsDB.updateAuditRequestStatusById(request.id, 'rejected');

    logInfo(MODULE, 'rejectAuditRequest', `Rejected request for ${request.email}`, { reason });

    return res.json({
      message: 'Request rejected',
    });
  } catch (err: any) {
    logError(MODULE, 'rejectAuditRequest', 'Failed to reject request', err);
    return res.status(400).json({ error: err.message });
  }
};
