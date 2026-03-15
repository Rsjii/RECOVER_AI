# Secrets Rotation Policy

## Scope
Applies to all secrets used by RecoverAI backend and CI:
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- Stripe and SendGrid credentials
- Database and Redis credentials
- OAuth client secrets

## Rotation Cadence
- High-risk auth secrets: every 30 days
- Integration/provider secrets: every 60 days
- Infra credentials: every 90 days
- Immediate rotation on any suspected exposure

## Rotation Procedure
1. Generate new secret in provider/vault.
2. Update staging env, validate critical flows.
3. Deploy to production with dual-secret compatibility when possible.
4. Revoke old secret after verification window.
5. Record rotation in incident/governance notes.

## Verification Checklist
- Auth/login and token refresh pass.
- Stripe and SendGrid webhooks still verify signatures.
- No spike in 401/403 errors after deployment.
- `requestId` tracing shows no secret-related failures.







