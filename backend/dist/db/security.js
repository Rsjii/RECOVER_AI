"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.isSessionActive = isSessionActive;
exports.findSessionByRefreshToken = findSessionByRefreshToken;
exports.revokeSession = revokeSession;
exports.revokeUserSessions = revokeUserSessions;
exports.listActiveSessions = listActiveSessions;
exports.listCompanyActiveSessions = listCompanyActiveSessions;
exports.revokeSessionById = revokeSessionById;
exports.revokeCompanySessionById = revokeCompanySessionById;
exports.rotateSessionToken = rotateSessionToken;
exports.rotateSession = rotateSession;
exports.revokeUserSessionsForRefreshToken = revokeUserSessionsForRefreshToken;
exports.registerWebhookEvent = registerWebhookEvent;
exports.completeWebhookEvent = completeWebhookEvent;
exports.failWebhookEvent = failWebhookEvent;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
async function createSession(input) {
    await database_1.pool.query(`INSERT INTO user_sessions (user_id, company_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, refresh_token_hash)
     DO UPDATE SET
       user_agent = EXCLUDED.user_agent,
       ip_address = EXCLUDED.ip_address,
       expires_at = EXCLUDED.expires_at,
       revoked_at = NULL`, [
        input.userId,
        input.companyId,
        hashToken(input.refreshToken),
        input.userAgent || null,
        input.ipAddress || null,
        input.expiresAt,
    ]);
}
async function isSessionActive(refreshToken) {
    const result = await database_1.pool.query(`SELECT 1
     FROM user_sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`, [hashToken(refreshToken)]);
    return !!result.rows[0];
}
async function findSessionByRefreshToken(refreshToken) {
    const result = await database_1.pool.query(`SELECT id, user_id, company_id, user_agent, ip_address, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE refresh_token_hash = $1
     LIMIT 1`, [hashToken(refreshToken)]);
    return result.rows[0] || null;
}
async function revokeSession(refreshToken) {
    await database_1.pool.query(`UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE refresh_token_hash = $1`, [hashToken(refreshToken)]);
}
async function revokeUserSessions(userId) {
    await database_1.pool.query(`UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`, [userId]);
}
async function listActiveSessions(userId, companyId) {
    const result = await database_1.pool.query(`SELECT id, user_id, company_id, user_agent, ip_address::text, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE user_id = $1
       AND company_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC`, [userId, companyId]);
    return result.rows;
}
async function listCompanyActiveSessions(companyId) {
    const result = await database_1.pool.query(`SELECT id, user_id, company_id, user_agent, ip_address::text, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE company_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC`, [companyId]);
    return result.rows;
}
async function revokeSessionById(sessionId, userId, companyId) {
    const result = await database_1.pool.query(`UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND company_id = $3
       AND revoked_at IS NULL
     RETURNING id`, [sessionId, userId, companyId]);
    return !!result.rows[0];
}
async function revokeCompanySessionById(sessionId, companyId) {
    const result = await database_1.pool.query(`UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1
       AND company_id = $2
       AND revoked_at IS NULL
     RETURNING id`, [sessionId, companyId]);
    return !!result.rows[0];
}
async function rotateSessionToken(input) {
    const oldHash = hashToken(input.refreshToken);
    const newHash = hashToken(input.newRefreshToken);
    const result = await database_1.pool.query(`UPDATE user_sessions
     SET refresh_token_hash = $2,
         user_agent = COALESCE($3, user_agent),
         ip_address = COALESCE($4, ip_address),
         expires_at = $5,
         revoked_at = NULL
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id, company_id`, [oldHash, newHash, input.userAgent || null, input.ipAddress || null, input.expiresAt]);
    if (!result.rows[0])
        return null;
    return { userId: result.rows[0].user_id, companyId: result.rows[0].company_id };
}
async function rotateSession(input) {
    const oldTokenHash = hashToken(input.oldRefreshToken);
    const newTokenHash = hashToken(input.newRefreshToken);
    const result = await database_1.pool.query(`WITH revoked AS (
       UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id, company_id
     )
     INSERT INTO user_sessions (user_id, company_id, refresh_token_hash, user_agent, ip_address, expires_at)
     SELECT user_id, company_id, $2, $3, $4, $5
     FROM revoked
     RETURNING id, user_id, company_id, user_agent, ip_address, created_at, expires_at, revoked_at`, [
        oldTokenHash,
        newTokenHash,
        input.userAgent || null,
        input.ipAddress || null,
        input.expiresAt,
    ]);
    if (!result.rows[0]) {
        throw new Error('Session revoked or expired');
    }
    return result.rows[0];
}
async function revokeUserSessionsForRefreshToken(refreshToken) {
    const session = await findSessionByRefreshToken(refreshToken);
    if (!session) {
        return 0;
    }
    const result = await database_1.pool.query(`UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`, [session.user_id]);
    return result.rowCount || 0;
}
async function registerWebhookEvent(input) {
    const result = await database_1.pool.query(`INSERT INTO webhook_events (provider, event_id, event_type, payload_hash, company_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`, [input.provider, input.eventId, input.eventType, input.payloadHash || null, input.companyId || null]);
    return !!result.rows[0];
}
async function completeWebhookEvent(provider, eventId) {
    await database_1.pool.query(`UPDATE webhook_events
     SET status = 'processed', processed_at = NOW()
     WHERE provider = $1 AND event_id = $2`, [provider, eventId]);
}
async function failWebhookEvent(provider, eventId, errorMessage) {
    await database_1.pool.query(`UPDATE webhook_events
     SET status = 'failed', error_message = $3
     WHERE provider = $1 AND event_id = $2`, [provider, eventId, errorMessage]);
}
