export interface SessionRow {
    id: string;
    user_id: string;
    company_id: string;
    user_agent: string | null;
    ip_address: string | null;
    created_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
}
export declare function createSession(input: {
    userId: string;
    companyId: string;
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
}): Promise<void>;
export declare function isSessionActive(refreshToken: string): Promise<boolean>;
export declare function findSessionByRefreshToken(refreshToken: string): Promise<SessionRow | null>;
export declare function revokeSession(refreshToken: string): Promise<void>;
export declare function revokeUserSessions(userId: string): Promise<void>;
export interface ActiveSessionRow {
    id: string;
    user_id: string;
    company_id: string;
    user_agent: string | null;
    ip_address: string | null;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
}
export declare function listActiveSessions(userId: string, companyId: string): Promise<ActiveSessionRow[]>;
export declare function listCompanyActiveSessions(companyId: string): Promise<ActiveSessionRow[]>;
export declare function revokeSessionById(sessionId: string, userId: string, companyId: string): Promise<boolean>;
export declare function revokeCompanySessionById(sessionId: string, companyId: string): Promise<boolean>;
export declare function rotateSessionToken(input: {
    refreshToken: string;
    newRefreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
}): Promise<{
    userId: string;
    companyId: string;
} | null>;
export declare function rotateSession(input: {
    oldRefreshToken: string;
    newRefreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
}): Promise<SessionRow>;
export declare function revokeUserSessionsForRefreshToken(refreshToken: string): Promise<number>;
export declare function registerWebhookEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadHash?: string;
    companyId?: string;
}): Promise<boolean>;
export declare function completeWebhookEvent(provider: string, eventId: string): Promise<void>;
export declare function failWebhookEvent(provider: string, eventId: string, errorMessage: string): Promise<void>;
