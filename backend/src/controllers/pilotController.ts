import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const MODULE = 'pilotController';

export const requestPilot = async (req: Request, res: Response): Promise<void> => {
  const handler = 'requestPilot';
  const { firstName, lastName, email, companyName, phone, invoicesPerMonth } = req.body;

  try {
    // Validate required fields
    if (!firstName || !lastName || !email || !companyName || !phone) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logInfo(MODULE, handler, 'Pilot request received', {
      email,
      companyName,
      invoicesPerMonth,
    });

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM pilots WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already submitted' });
      return;
    }

    // Insert into pilots table
    const result = await pool.query(
      `INSERT INTO pilots (first_name, last_name, email, company_name, phone, invoices_per_month, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [firstName, lastName, email, companyName, phone, invoicesPerMonth]
    );

    const pilotId = result.rows[0].id;

    logInfo(MODULE, handler, 'Pilot application saved', {
      pilotId,
      email,
      companyName,
    });

    // TODO: Send Slack notification to founder
    // TODO: Send confirmation email to pilot
    // For now, just return success

    res.status(200).json({
      success: true,
      message: 'Thanks for applying! We\'ll review your application and contact you within 24 hours.',
      pilotId,
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to submit pilot request', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};
