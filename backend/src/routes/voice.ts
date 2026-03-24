import { Router } from 'express';
import { generateTwiML, handleDTMF, handleStatusCallback, getVoiceStats, testVoiceCall } from '../controllers/voiceController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public endpoints (no auth required for Twilio callbacks)
router.get('/twiml', generateTwiML);
router.post('/handle-dtmf', handleDTMF);
router.post('/status-callback', handleStatusCallback);

// Authenticated endpoints
router.get('/stats', authMiddleware, getVoiceStats);
router.post('/test-call', authMiddleware, testVoiceCall);

export default router;
