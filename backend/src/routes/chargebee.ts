import { Router } from 'express';
import { connectChargebee, syncChargebeeInvoices, chargebeeWebhook, disconnectChargebee } from '../controllers/chargebeeController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// Webhook (no auth — from Chargebee servers)
router.post('/webhook', chargebeeWebhook);

// Protected routes
router.post('/connect', authMiddleware, demoBlocker, connectChargebee);
router.post('/sync', authMiddleware, demoBlocker, syncChargebeeInvoices);
router.delete('/disconnect', authMiddleware, demoBlocker, disconnectChargebee);

export default router;
