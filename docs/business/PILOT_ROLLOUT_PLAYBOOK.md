# Pilot Rollout Playbook

## Objective
Onboard 2-3 pilot B2B SaaS customers with controlled risk and measurable activation outcomes.

## Entry Criteria
- Billing + entitlements enabled.
- Tenant isolation and RBAC checks passing.
- Compliance export/delete endpoints active.
- Health checks and incident runbook published.

## Pilot Steps
1. Select pilot cohort and assign CSM owner.
2. Configure organization, team roles, and policy defaults.
3. Connect integrations and verify first sync.
4. Execute first collection cycle in assisted mode.
5. Review outcomes and switch autonomy level if approved.

## Weekly Governance Review
- Incident summary (if any)
- Billing disputes and corrections
- Policy overrides and approval queue stats
- Activation metrics: signup -> first collection time
- Recovery outcomes by customer
- Feature flag change log for risky controls
- Session revocation and suspicious login summary
- Webhook replay/idempotency exception report

## Exit Criteria
- No unresolved SEV-1 incidents.
- No cross-tenant security issues.
- At least one successful billing cycle per pilot customer.
- Customer sign-off on value and controls.

## Automation Hooks
- Run `npm run ops:weekly-governance` once per week to generate evidence JSON.
- Attach governance artifact and incident links to weekly ops review notes.


