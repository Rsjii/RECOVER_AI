import { pool } from '../config/database';
import { redisClient, isRedisConnected } from '../config/redis';
import { config } from '../config/env';
import { logError, logInfo } from '../utils/logger';
import { savePlatformDailyStat } from '../db/adminStats';

const LOG_MODULE = 'redisStatsJob';

/**
 * Parse Upstash REST credentials from the existing REDIS_URL.
 * rediss://default:TOKEN@host.upstash.io:6379
 * → { restUrl: 'https://host.upstash.io', restToken: 'TOKEN' }
 */
function parseUpstashCredentials(redisUrl: string): { restUrl: string; restToken: string } | null {
  try {
    const url = new URL(redisUrl);
    const restToken = url.password; // the auth token is the URL password
    const restUrl = `https://${url.hostname}`;
    if (!restToken || !url.hostname) return null;
    return { restUrl, restToken };
  } catch {
    return null;
  }
}

/**
 * Snapshot Redis command count + bandwidth via two methods:
 * 1. Redis INFO stats (via existing connection) — total_commands_processed
 * 2. Upstash REST API — total_net_output_bytes (bandwidth)
 *
 * Stores cumulative totals + daily deltas in platform_daily_stats.
 * Safe to run multiple times — uses ON CONFLICT upsert.
 */
export async function snapshotRedisStats(): Promise<void> {
  const handler = 'snapshotRedisStats';

  if (!isRedisConnected()) {
    logInfo(LOG_MODULE, handler, 'Redis not connected — skipping snapshot');
    return;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // ── 1. Redis INFO stats (command count) ──────────────────────
  try {
    const infoStr = await redisClient.sendCommand(['INFO', 'stats']) as string;
    const cmdMatch = infoStr.match(/total_commands_processed:(\d+)/);
    const totalNow = cmdMatch ? parseInt(cmdMatch[1], 10) : 0;

    // Save today's cumulative snapshot
    await savePlatformDailyStat(today, 'redis_commands_total', totalNow);

    // Read yesterday's cumulative to compute daily delta
    const prevRows = await pool.query(
      `SELECT value FROM platform_daily_stats
       WHERE metric_key = 'redis_commands_total' AND date = $1`,
      [yesterdayStr]
    );
    const totalYesterday = prevRows.rows[0]?.value ?? totalNow;
    const dailyDelta = Math.max(0, totalNow - Number(totalYesterday));
    await savePlatformDailyStat(yesterday, 'redis_commands_daily', dailyDelta);

    logInfo(LOG_MODULE, handler, 'Commands snapshot saved', { totalNow, dailyDelta });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed to snapshot command count', err);
  }

  // ── 2. Upstash REST API (bandwidth) ──────────────────────────
  const creds = config.redisUrl ? parseUpstashCredentials(config.redisUrl) : null;
  if (!creds) {
    logInfo(LOG_MODULE, handler, 'Could not parse Upstash credentials from REDIS_URL — skipping bandwidth');
    return;
  }

  try {
    const resp = await fetch(`${creds.restUrl}/info/stats`, {
      headers: { Authorization: `Bearer ${creds.restToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      logInfo(LOG_MODULE, handler, 'Upstash REST returned non-200', { status: resp.status });
      return;
    }

    const data = await resp.json() as { result?: string };
    const infoStr = data.result ?? '';

    // Parse bandwidth (cumulative bytes sent by Redis to clients)
    const bytesMatch = infoStr.match(/total_net_output_bytes:(\d+)/);
    const bytesTotal = bytesMatch ? parseInt(bytesMatch[1], 10) : 0;

    await savePlatformDailyStat(today, 'redis_bandwidth_bytes_total', bytesTotal);

    // Daily delta
    const prevBwRows = await pool.query(
      `SELECT value FROM platform_daily_stats
       WHERE metric_key = 'redis_bandwidth_bytes_total' AND date = $1`,
      [yesterdayStr]
    );
    const bytesYesterday = prevBwRows.rows[0]?.value ?? bytesTotal;
    const bytesDelta = Math.max(0, bytesTotal - Number(bytesYesterday));
    await savePlatformDailyStat(yesterday, 'redis_bandwidth_bytes_daily', bytesDelta);

    logInfo(LOG_MODULE, handler, 'Bandwidth snapshot saved', { bytesTotal, bytesDelta });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed to fetch Upstash REST bandwidth', err);
  }
}
