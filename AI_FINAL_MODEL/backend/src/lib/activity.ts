import { db } from '../config/db';
import { logger } from '../config/logger';

export async function logActivity(
  orgId: string,
  userId: string | null,
  activityType: string,
  description: string
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO activity_log (org_id, user_id, activity_type, description)
       VALUES ($1, $2, $3, $4)`,
      [orgId, userId ?? null, activityType, description]
    );
  } catch (err) {
    logger.error({ err }, '[Activity] Failed to log');
  }
}
