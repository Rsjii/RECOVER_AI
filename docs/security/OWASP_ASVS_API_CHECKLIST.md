# OWASP ASVS / API Security Checklist

## Authentication and Session
- [x] Access tokens short-lived (1h)
- [x] Refresh token rotation enabled
- [x] Session revocation endpoints available
- [x] Auth throttling + slowdown enabled

## Access Control
- [x] RBAC middleware on sensitive routes
- [x] Tenant scope guard for body/query tenant mismatch
- [x] DB-level RLS policies enabled
- [x] Force RLS on tenant tables

## Input and Output Validation
- [x] Route-level schema validation for key auth/integration payloads
- [x] Standardized error response shape (`code`, `error`, `requestId`, `details`)
- [x] Request correlation headers (`x-request-id`)

## Cryptography and Secrets
- [x] Sensitive provider keys encrypted at rest
- [x] Secret rotation policy documented
- [x] Security workflow includes audit and SBOM generation

## Webhook and External Events
- [x] Stripe signature verification
- [x] SendGrid replay window checks
- [x] Webhook event-store idempotency (`webhook_events`)

## Logging and Monitoring
- [x] Structured logs with request context
- [x] Optional Sentry initialization
- [x] Incident runbook and pilot governance workflow documented







