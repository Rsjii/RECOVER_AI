import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import { config } from '../config/env';
import { logInfo } from '../utils/logger';

const MODULE = 'UnsubscribeRoute';

const router = Router();

/**
 * POST /api/unsubscribe?token=xxx&email=xxx&company=xxx
 * Handle unsubscribe requests from email links
 * Token is HMAC-SHA256(email:companyId)
 */
router.post('/', async (req, res) => {
  const handler = 'unsubscribe';
  const { token, email, company } = req.query;

  try {
    if (!token || !email || !company || typeof token !== 'string' || typeof email !== 'string' || typeof company !== 'string') {
      res.status(400).json({ error: 'Missing or invalid parameters' });
      return;
    }

    // Verify HMAC token
    const unsubData = `${email}:${company}`;
    const hmac = crypto.createHmac('sha256', config.jwtSecret || 'fallback-secret');
    hmac.update(unsubData);
    const expectedToken = hmac.digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    // Look up customer by email + company
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE email = $1 AND company_id = $2',
      [email, company]
    );

    if (customerResult.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const customerId = customerResult.rows[0].id;

    // Update customer to disable dunning emails
    await pool.query(
      `UPDATE customers
       SET dunning_emails_opt_out = true, dunning_emails_opt_out_at = NOW()
       WHERE id = $1`,
      [customerId]
    );

    logInfo(MODULE, handler, 'Customer unsubscribed from dunning emails', {
      customerId,
      company,
      email
    });

    // Return HTML confirmation page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 20px 25px rgba(0,0,0,0.1);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin: 20px 0;
      font-size: 24px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin: 15px 0;
      font-size: 14px;
    }
    .note {
      background: #f0f4ff;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
      text-align: left;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive dunning emails from CashOS.</p>

    <div class="note">
      <strong>Note:</strong> You may still receive important notifications about your account, but collection-related dunning emails will be paused.
    </div>

    <p style="color: #999; font-size: 12px; margin-top: 40px;">
      If you have questions, contact support@recover-ai.com
    </p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

export default router;
