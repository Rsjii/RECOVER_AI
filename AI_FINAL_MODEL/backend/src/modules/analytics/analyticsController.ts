import { Request, Response } from 'express';
import { sprintHealthService } from '../../services/sprintHealthService';
import { velocityService } from '../../services/velocityService';
import { logger } from '../../config/logger';

export async function getSprintHealth(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const data = await sprintHealthService.getAllActiveSprintScores(orgId);
    res.json(data);
  } catch (err) {
    logger.error({ err }, '[Analytics] getSprintHealth error');
    res.status(500).json({ error: 'Failed to fetch sprint health' });
  }
}

export async function getVelocity(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const data = await velocityService.getVelocityData(orgId);
    res.json(data);
  } catch (err) {
    logger.error({ err }, '[Analytics] getVelocity error');
    res.status(500).json({ error: 'Failed to fetch velocity data' });
  }
}
