import { Router } from 'express';
import { pool } from '../config/database';
import { logInfo } from '../utils/logger';

const MODULE = 'UnsubscribeRoute';

const router = Router();

/**
 * POST /api/unsubscribe?token=xxx
 * Handle unsubscribe requests from email links
 * Token is base64(customerId:companyId:timestamp)
 */
router.post('/', async (req, res) => {
  const handler = 'unsubscribe';
  const { token } = req.query;

  try {
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Missing or invalid token' });
      return;
    }

    // Decode token (simple base64, not cryptographic)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [customerId, companyId] = decoded.split(':');

    if (!customerId || !companyId) {
      res.status(400).json({ error: 'Invalid token format' });
      return;
    }

    // Verify customer exists and belongs to company
    const customerResult = await pool.query(
      'SELECT id, email FROM customers WHERE id = $1 AND company_id = $2',
      [customerId, companyId]
    );

    if (customerResult.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const customer = customerResult.rows[0];

    // Update customer to disable dunning emails
    await pool.query(
      `UPDATE customers
       SET dunning_emails_opt_out = true, dunning_emails_opt_out_at = NOW()
       WHERE id = $1`,
      [customerId]
    );

    logInfo(MODULE, handler, 'Customer unsubscribed from dunning emails', {
      customerId,
      companyId,
      email: customer.email
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
    <p>You will no longer receive dunning emails from RecoverAI.</p>

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
