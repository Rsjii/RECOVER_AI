import { Router } from 'express';
import { connectChargebee, syncChargebeeInvoices, chargebeeWebhook, disconnectChargebee } from '../controllers/chargebeeController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Webhook (no auth — from Chargebee servers)
router.post('/webhook', chargebeeWebhook);

// Protected routes
router.post('/connect', authMiddleware, connectChargebee);
router.post('/sync', authMiddleware, syncChargebeeInvoices);
router.delete('/disconnect', authMiddleware, disconnectChargebee);

export default router;
