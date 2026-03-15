# Incident Response Runbook

## Scope
Operational response for API outages, queue failures, billing failures, webhook failures, and security incidents.

## Severity Matrix
- SEV-1: Production down, data breach risk, billing corruption.
- SEV-2: Core functionality degraded (sync failures, webhook backlog).
- SEV-3: Non-critical degradation or UI-only issues.

## Detection Sources
- Health endpoints: `/health`, `/ready`, `/live`
- Backend logs with request correlation IDs
- Queue worker errors and retry spikes
- Payment/webhook failure counts
- Sentry alerts (if `SENTRY_DSN` configured)
- Feature-flag rollout anomalies (policy bypass/autonomous sends)

## First 15 Minutes
1. Confirm incident and assign commander.
2. Freeze risky deploys.
3. Collect scope: endpoints, tenants impacted, time window.
4. Post internal status update with ETA.

## Recovery Playbooks
- API down:
  - Check DB and Redis connectivity.
  - Restart workers then app.
  - Validate `/ready`.
- Stripe webhook failure:
  - Validate signature secret.
  - Replay missed events from provider.
  - Verify idempotency logs.
  - Check `webhook_events` table for duplicate or failed statuses.
- Billing discrepancy:
  - Freeze invoice generation jobs.
  - Run reconciliation query for affected period.
  - Generate corrected credit note.
  - Run `npm run ops:backup-evidence` after remediation for evidence trail.

## Post-Incident
- Publish timeline with root cause and corrective actions.
- Add or update monitoring alert.
- Add test/regression case.

## Security Incident Addendum
- Rotate impacted secrets immediately (Stripe, SendGrid, JWT, refresh secret).
- Invalidate active sessions if auth compromise suspected.
- Capture forensic query snapshots with `requestId` correlation.

## Evidence Artifacts
- Store generated artifacts under `backend/artifacts/`:
  - backup/restore evidence JSON
  - weekly governance report JSON
  - incident timeline markdown


