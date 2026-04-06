import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { insertErrorLog, getErrorLogs, getErrorStats, getErrorTrendsByModule } from '../db/errorLogs';
import { logInfo, logError } from '../utils/logger';

const router = Router();

/**
 * POST /api/logs/errors - Log a frontend error
 * Auth: Not required (can be called from unauthenticated state)
 * Company isolation: Via header or JWT
 */
router.post('/errors', async (req: Request, res: Response) => {
  try {
    const { module, handler, message, error } = req.body;

    // Get company ID from auth or anonymous tracking
    let companyId = (req as any).companyId;

    if (!companyId) {
      // Anonymous error - try to get from header
      companyId = req.headers['x-company-id'] as string || 'unknown';
    }

    if (!module || !handler || !message) {
      return res.status(400).json({ error: 'Missing required fields: module, handler, message' });
    }

    const userId = (req as any).userId || undefined;
    const url = req.body.url || undefined;

    await insertErrorLog(companyId, module, handler, message, error, userId, url);

    logInfo('logs', 'postErrors', `Error logged: ${module}:${handler}`, { companyId, module, handler });
    res.status(200).json({ success: true, message: 'Error logged' });
  } catch (err) {
    logError('logs', 'postErrors', 'Failed to log error', err);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

/**
 * GET /api/logs/errors - Get error logs for admin
 * Auth: Required (admin only)
 */
router.get('/errors', authMiddleware, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check admin permission
    const isAdmin = (req as any).role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const filter: any = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.handler) filter.handler = req.query.handler;
    if (req.query.search) filter.search = req.query.search;
    if (req.query.hoursAgo) filter.hoursAgo = parseInt(req.query.hoursAgo as string);

    const result = await getErrorLogs(companyId, limit, offset, filter);

    res.json({
      data: {
        logs: result.logs,
        pagination: {
          limit,
          offset,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (err) {
    logError('logs', 'getErrors', 'Failed to fetch error logs', err);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

/**
 * GET /api/logs/errors/stats - Get error statistics
 */
router.get('/errors/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hoursAgo = parseInt(req.query.hoursAgo as string) || 24;
    const stats = await getErrorStats(companyId, hoursAgo);
    const trends = await getErrorTrendsByModule(companyId, hoursAgo);

    res.json({ data: { stats, trends } });
  } catch (err) {
    logError('logs', 'getErrorStats', 'Failed to fetch error stats', err);
    res.status(500).json({ error: 'Failed to fetch error stats' });
  }
});

export default router;