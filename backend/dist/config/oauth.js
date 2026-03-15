"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleClient = getGoogleClient;
exports.verifyGoogleToken = verifyGoogleToken;
exports.exchangeCodeForToken = exchangeCodeForToken;
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("./env");
let googleClient = null;
function getGoogleClient() {
    if (!googleClient) {
        if (!env_1.config.google.clientId || !env_1.config.google.clientSecret) {
            throw new Error('Google OAuth credentials not configured');
        }
        googleClient = new google_auth_library_1.OAuth2Client(env_1.config.google.clientId, env_1.config.google.clientSecret, `${env_1.config.baseUrl}/api/auth/oauth/google/callback`);
    }
    return googleClient;
}
async function verifyGoogleToken(token) {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: env_1.config.google.clientId,
    });
    return ticket.getPayload();
}
async function exchangeCodeForToken(code) {
    const client = getGoogleClient();
    const { tokens } = await client.getToken(code);
    return tokens;
}
