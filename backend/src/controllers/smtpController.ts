import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { getSMTPStatus, saveSMTPConfig, testSMTPConnection, disableSMTP } from '../services/smtpService';

const MODULE = 'smtpController';

/**
 * GET /api/settings/smtp/status
 * Get SMTP configuration status
 */
export async function getSMTPStatusHandler(req: Request, res: Response): Promise<void> {
  const method = 'getSMTPStatusHandler';
  const companyId = (req as any).companyId;

  if (!companyId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const status = await getSMTPStatus(companyId);
    logInfo(MODULE, method, 'SMTP status retrieved', { companyId });
    res.json(status);
  } catch (err) {
    logError(MODULE, method, 'Failed to get SMTP status', err);
    res.status(500).json({ error: 'Failed to retrieve SMTP status' });
  }
}

/**
 * POST /api/settings/smtp/configure
 * Save SMTP configuration (but don't enable yet — requires test first)
 */
export async function configureSmtpHandler(req: Request, res: Response): Promise<void> {
  const method = 'configureSmtpHandler';
  const companyId = (req as any).companyId;

  if (!companyId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { host, port, username, password, fromEmail, fromName } = req.body;

    // Validate required fields
    if (!host || !port || !username || !password || !fromEmail) {
      res.status(400).json({ error: 'Missing required SMTP fields' });
      return;
    }

    // Validate port is reasonable
    if (port < 1 || port > 65535) {
      res.status(400).json({ error: 'Invalid port number' });
      return;
    }

    const result = await saveSMTPConfig(companyId, {
      host,
      port,
      username,
      password,
      fromEmail,
      fromName: fromName || 'Billing Team',
    });

    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to save SMTP config' });
      return;
    }

    logInfo(MODULE, method, 'SMTP config saved', { companyId });
    res.json({ success: true, message: 'SMTP config saved. Please test connection next.' });
  } catch (err) {
    logError(MODULE, method, 'Failed to save SMTP config', err);
    res.status(500).json({ error: 'Failed to save SMTP configuration' });
  }
}

/**
 * POST /api/settings/smtp/test
 * Test SMTP connection and mark as verified if successful
 */
export async function testSmtpHandler(req: Request, res: Response): Promise<void> {
  const method = 'testSmtpHandler';
  const companyId = (req as any).companyId;

  if (!companyId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { host, port, username, password, fromEmail, fromName } = req.body;

    // Validate required fields
    if (!host || !port || !username || !password || !fromEmail) {
      res.status(400).json({ error: 'Missing required SMTP fields' });
      return;
    }

    logInfo(MODULE, method, 'Testing SMTP connection', { companyId, host });

    const result = await testSMTPConnection(companyId, {
      host,
      port,
      username,
      password,
      fromEmail,
      fromName: fromName || 'Billing Team',
    });

    if (result.success) {
      logInfo(MODULE, method, 'SMTP connection verified', { companyId });
      res.json({
        success: true,
        message: 'SMTP connection successful! Test email sent to ' + fromEmail,
      });
    } else {
      logInfo(MODULE, method, 'SMTP connection failed', { companyId, error: result.error });
      res.status(400).json({
        success: false,
        error: result.error || 'SMTP connection failed',
      });
    }
  } catch (err) {
    logError(MODULE, method, 'SMTP test failed with exception', err);
    res.status(500).json({
      success: false,
      error: 'SMTP test failed: ' + (err instanceof Error ? err.message : String(err)),
    });
  }
}

/**
 * POST /api/settings/smtp/disable
 * Disable SMTP (revert to Resend fallback)
 */
export async function disableSmtpHandler(req: Request, res: Response): Promise<void> {
  const method = 'disableSmtpHandler';
  const companyId = (req as any).companyId;

  if (!companyId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await disableSMTP(companyId);
    logInfo(MODULE, method, 'SMTP disabled', { companyId });
    res.json({ success: true, message: 'SMTP disabled. Using Resend for emails.' });
  } catch (err) {
    logError(MODULE, method, 'Failed to disable SMTP', err);
    res.status(500).json({ error: 'Failed to disable SMTP' });
  }
}