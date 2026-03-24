import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import * as CompanyDB from '../db/companies';
import * as UserDB from '../db/users';
import crypto from 'crypto';

const MODULE = 'adminPilotController';

export const createPilotCompany = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createPilotCompany';
  const { name, email, timezone } = req.body;

  try {
    if (!name || !email) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logInfo(MODULE, handler, 'Creating pilot company', { name, email });

    // Create company with pilot account_type
    const result = await pool.query(
      `INSERT INTO companies (name, email, timezone, account_type, subscription_status, pilot_ends_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '3 months')
       RETURNING id, name, email`,
      [name, email, timezone || 'UTC', 'pilot', 'active']
    );

    const company = result.rows[0];

    logInfo(MODULE, handler, 'Pilot company created', { companyId: company.id });

    res.status(201).json({
      success: true,
      companyId: company.id,
      company,
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to create pilot company', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
};

export const createPilotUser = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createPilotUser';
  const { companyId, email, firstName, lastName, role } = req.body;

  try {
    if (!companyId || !email || !firstName || !lastName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logInfo(MODULE, handler, 'Creating pilot user', { companyId, email });

    // Generate temporary setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const result = await pool.query(
      `INSERT INTO users (
        company_id, email, first_name, last_name, role,
        password_hash, email_verified, setup_token, setup_token_expires
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, first_name, last_name`,
      [
        companyId,
        email,
        firstName,
        lastName,
        role || 'owner',
        crypto.randomBytes(32).toString('hex'), // Placeholder
        false,
        setupToken,
        setupTokenExpires,
      ]
    );

    const user = result.rows[0];

    logInfo(MODULE, handler, 'Pilot user created', { userId: user.id, email });

    // TODO: Send email with setup link
    // const setupLink = `${process.env.FRONTEND_URL}/setup-password?token=${setupToken}`;
    // await sendSetupEmail(email, firstName, setupLink);

    res.status(201).json({
      success: true,
      userId: user.id,
      user,
      setupToken, // Return token for testing (in production, send via email only)
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to create pilot user', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const setupPilotPassword = async (req: Request, res: Response): Promise<void> => {
  const handler = 'setupPilotPassword';
  const { token, password } = req.body;

  try {
    if (!token || !password) {
      res.status(400).json({ error: 'Missing token or password' });
      return;
    }

    // Validate password
    if (password.length < 12) {
      res.status(400).json({ error: 'Password must be at least 12 characters' });
      return;
    }

    // Find user with valid token
    const result = await pool.query(
      `SELECT id, email FROM users
       WHERE setup_token = $1 AND setup_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const user = result.rows[0];

    // Hash password and update user
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `UPDATE users
       SET password_hash = $1, email_verified = true, setup_token = NULL, setup_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    logInfo(MODULE, handler, 'Pilot password set', { userId: user.id });

    res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now log in.',
      email: user.email,
    });
  } catch (error) {
    logError(MODULE, handler, 'Failed to setup password', error);
    res.status(500).json({ error: 'Failed to setup password' });
  }
};
