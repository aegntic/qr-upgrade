# Gates for the next product phases

The web beta implements local design workflows, bounded live AI generation, and credential-gated individual cloud accounts. These are not enterprise assurance claims. G19 blocks representing the enterprise capabilities below as complete until implementation and evidence exist. See runtime-data-flow.md for current technical scope.

| Feature | Required launch checks |
|---|---|
| Accounts / enterprise workspaces | Approved IdP design; SSO and MFA; secure sessions; server-side organization membership; RBAC; recovery/offboarding; no client-controlled tenant selection; cross-tenant negative tests for every read/write/export. |
| Native authentication | OIDC authorization code + PKCE through the system browser; verified redirect/app links; secure platform token storage; bounded sessions, logout/revocation and refresh-token protection. |
| Cloud campaigns / brand kits | Tenant isolation and object-level authorization, encryption/key management, restricted object storage, deletion/retention controls, access audit events, backups and tested restore. |
| Dynamic QR links / GEO | Redirect/abuse protections, safe destination validation, threat/abuse reporting, authenticated edits, reliable rollback, region/privacy review, no unnecessary precise location collection. |
| Live AI artwork generation (bundled examples and local image integration already exist) | Approved processor and data-use agreement, explicit data minimization, prompt/upload handling, output content constraints, cost/rate controls and deterministic QR validation before export. |
| Teams / API customers | Scoped short-lived credentials or managed OAuth, per-tenant quotas, identity-bound audit events, revocation, access review, API authorization tests and versioned contracts. The current single service credential is not a tenant API. |
| Billing | Hosted payment entry, signed webhook verification, idempotency, authorization and replay tests; assess actual PCI scope instead of assuming the product is PCI certified. |
| Enterprise promises | Measured and approved SLA, incident contacts, actual data regions, retention controls, verified supplier list and real assurance reports. |
