import { OAuth2Client } from 'google-auth-library';
export declare function getGoogleClient(): OAuth2Client;
export declare function verifyGoogleToken(token: string): Promise<import("google-auth-library").TokenPayload | undefined>;
export declare function exchangeCodeForToken(code: string): Promise<import("google-auth-library").Credentials>;
