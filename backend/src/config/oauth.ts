import { OAuth2Client } from 'google-auth-library';
import { config } from './env';

let googleClient: OAuth2Client | null = null;

export function getGoogleClient(): OAuth2Client {
  if (!googleClient) {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    googleClient = new OAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      `${config.baseUrl}/api/auth/oauth/google/callback`
    );
  }
  return googleClient;
}

export async function verifyGoogleToken(token: string) {
  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: config.google.clientId,
  });
  return ticket.getPayload();
}

export async function exchangeCodeForToken(code: string) {
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}
