# NFR and SLO Baseline

## Availability
- API availability target: 99.9% monthly
- Billing and policy endpoints: 99.95% monthly

## Latency
- P95 for read APIs: < 400ms
- P95 for write APIs: < 700ms
- P99 for all APIs: < 1500ms

## Security
- Enforce secure headers and CSP.
- All sensitive actions require authenticated and authorized roles.
- Webhooks must be signature-verified and idempotent.

## Data Integrity
- Backward-compatible migrations only.
- Monthly billing invoice generation must be idempotent.
- Audit logs required for security, billing, compliance, and policy actions.

## Reliability
- Queue jobs retried with bounded exponential backoff.
- DLQ or equivalent dead-letter visibility required.
- Backup restore drill at least monthly.


