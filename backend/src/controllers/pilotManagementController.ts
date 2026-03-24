import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import * as crypto from 'crypto';

const MODULE = 'pilotManagementController';

/**
 * GET /api/admin/pilots
 * List all pilot applications with filtering
 */
export const listPilots = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listPilots';
  const { status } = req.query;

  try {
    let query = 'SELECT * FROM pilots ORDER BY created_at DESC';
    const params: any[] = [];

    if (status) {
      query = 'SELECT * FROM pilots WHERE status = $1 ORDER BY created_at DESC';
      params.push(status);
    }

    const result = await pool.query(query, params);

    res.status(200).json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to list pilots', error);
    res.status(500).json({ error: 'Failed to fetch pilots' });
  }
};

/**
 * POST /api/admin/pilots/:pilotId/approve
 * Approve pilot, schedule demo
 */
export const approvePilot = async (req: Request, res: Response): Promise<void> => {
  const handler = 'approvePilot';
  const { pilotId } = req.params;
  const { demoScheduledAt } = req.body;

  try {
    if (!demoScheduledAt) {
      res.status(400).json({ error: 'Demo scheduled time required' });
      return;
    }

    const result = await pool.query(
      `UPDATE pilots
       SET status = 'demo_scheduled',
           demo_scheduled_at = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [demoScheduledAt, pilotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pilot not found' });
      return;
    }

    logInfo(MODULE, handler, 'Pilot approved', {
      pilotId,
      email: result.rows[0].email,
    });

    // TODO: Send demo scheduling email to pilot

    res.status(200).json({
      success: true,
      message: 'Pilot approved, demo scheduled',
      pilot: result.rows[0],
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to approve pilot', error);
    res.status(500).json({ error: 'Failed to approve pilot' });
  }
};

/**
 * POST /api/admin/pilots/:pilotId/reject
 * Reject pilot application
 */
export const rejectPilot = async (req: Request, res: Response): Promise<void> => {
  const handler = 'rejectPilot';
  const { pilotId } = req.params;
  const { reason } = req.body;

  try {
    const result = await pool.query(
      `UPDATE pilots
       SET status = 'rejected',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [pilotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pilot not found' });
      return;
    }

    logInfo(MODULE, handler, 'Pilot rejected', {
      pilotId,
      email: result.rows[0].email,
      reason,
    });

    // TODO: Send rejection email

    res.status(200).json({
      success: true,
      message: 'Pilot rejected',
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to reject pilot', error);
    res.status(500).json({ error: 'Failed to reject pilot' });
  }
};

/**
 * POST /api/admin/pilots/:pilotId/complete-audit
 * Mark audit complete, set estimated recovery, start pilot
 */
export const completeAudit = async (req: Request, res: Response): Promise<void> => {
  const handler = 'completeAudit';
  const { pilotId } = req.params;
  const { estimatedRecoveryUsd, pilotDurationDays = 14 } = req.body;

  try {
    if (!estimatedRecoveryUsd) {
      res.status(400).json({ error: 'Estimated recovery amount required' });
      return;
    }

    const pilotStartDate = new Date();
    const pilotEndDate = new Date(pilotStartDate.getTime() + pilotDurationDays * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `UPDATE pilots
       SET status = 'pilot_active',
           audit_completed_at = NOW(),
           estimated_recovery_usd = $1,
           pilot_start_date = $2,
           pilot_end_date = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [estimatedRecoveryUsd, pilotStartDate, pilotEndDate, pilotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pilot not found' });
      return;
    }

    const pilot = result.rows[0];

    // Now create the pilot account
    const createAccountResult = await pool.query(
      `INSERT INTO companies (
         name, email, subscription_status,
         account_type, pilot_ends_at, timezone
       ) VALUES ($1, $2, 'active', 'pilot', $3, 'UTC')
       RETURNING id`,
      [pilot.company_name, pilot.email, pilotEndDate]
    );

    const companyId = createAccountResult.rows[0].id;

    // Update pilot record with company_id
    await pool.query(
      'UPDATE pilots SET company_id = $1 WHERE id = $2',
      [companyId, pilotId]
    );

    logInfo(MODULE, handler, 'Audit completed, pilot activated', {
      pilotId,
      companyId,
      email: pilot.email,
      estimatedRecoveryUsd,
    });

    // TODO: Send setup email with token link

    res.status(200).json({
      success: true,
      message: 'Audit completed, pilot account created',
      pilot: {
        ...pilot,
        company_id: companyId,
        pilot_start_date: pilotStartDate,
        pilot_end_date: pilotEndDate,
      },
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to complete audit', error);
    res.status(500).json({ error: 'Failed to complete audit' });
  }
};

/**
 * POST /api/admin/pilots/:pilotId/convert
 * Mark pilot as converted to paid customer
 */
export const convertPilot = async (req: Request, res: Response): Promise<void> => {
  const handler = 'convertPilot';
  const { pilotId } = req.params;

  try {
    const result = await pool.query(
      `UPDATE pilots
       SET status = 'converted',
           conversion_decision = 'converted',
           conversion_date = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [pilotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pilot not found' });
      return;
    }

    const pilot = result.rows[0];

    // Update company subscription status
    if (pilot.company_id) {
      await pool.query(
        "UPDATE companies SET subscription_status = 'active', billing_tier = 1 WHERE id = $1",
        [pilot.company_id]
      );
    }

    logInfo(MODULE, handler, 'Pilot converted to paid', {
      pilotId,
      email: pilot.email,
    });

    res.status(200).json({
      success: true,
      message: 'Pilot converted to paid customer',
      pilot: result.rows[0],
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to convert pilot', error);
    res.status(500).json({ error: 'Failed to convert pilot' });
  }
};

/**
 * GET /api/admin/pilots/:pilotId
 * Get single pilot with full details
 */
export const getPilot = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPilot';
  const { pilotId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM pilots WHERE id = $1',
      [pilotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pilot not found' });
      return;
    }

    res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to get pilot', error);
    res.status(500).json({ error: 'Failed to fetch pilot' });
  }
};
