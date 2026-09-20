# Security, access and change policy — DRAFT FOR APPROVAL

Effective date / owner / approver: unassigned. This file records proposed operating requirements; it is not evidence they operate.

Maintain inventories for code, domains, hosting, secrets, devices, developer accounts and suppliers. Every asset and credential has a named owner. Use individual accounts, MFA and least privilege on all administrative platforms; prohibit shared administrator credentials. Use managed devices with disk encryption, screen lock and supported security patches. Restrict emergency access, record every use and review it afterward.

Access is approved for a documented role, reviewed at least quarterly and removed promptly when a person leaves or changes role. Production privileges and service-account credentials have separate reviews; test revocation. Store server secrets in approved secret managers and native authentication credentials, when implemented, in platform secure storage. Do not put service keys into client bundles, repository files, build logs or public evidence.

Changes pass independent review and required security checks on a protected branch. Workflow, policy, identity, signing and security-boundary changes require the designated security owner. CI uses read-only permissions by default, no secrets in untrusted pull-request jobs, and pinned action commits. Production deployments use protected environments and a release-specific approved evidence report. Direct hosting-console deployments must be restricted or covered by the same approved emergency procedure.

Keep dependency updates and security scans active, triage alerts to a real owner and retain decisions. Proposed remediation targets for owner approval: actively exploited/critical issues within 24 hours, high within 7 days, moderate within 30 days, low within 90 days, or a shorter risk-driven response. The current technical gate blocks any known npm advisory; a threshold change needs explicit security review and a time-limited exception process, not `--force` or scanner suppression without justification.

Before release, review the dependency license inventory, obtain independent security assessment where required, verify signed mobile artifacts, and perform documented rollback checks. No compliance badge, certification date, SLA, security contact or supplier claim is published without verified supporting evidence.
