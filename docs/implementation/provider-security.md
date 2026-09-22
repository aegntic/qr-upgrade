# Provider security verification — 20 September 2026

Engineering observations, not owner approval or certification.

## Application edge

QR Upgrade resolves directly to Vercel through Cloudflare DNS-only CNAMEs. Cloudflare zone HTTP/TLS/WAF settings therefore do not protect this application path. Vercel presents a trusted certificate and TLS 1.3 (AES-128-GCM); observed expiry 17 December 2026. Preview protection covers deployments other than custom domains. Public custom domains intentionally remain public.

Vercel WAF configuration version 1 enables one API rule: 120 requests per fixed 60-second window per source IP, excluding the exactly matched `/api/billing/webhook` path. Requests beyond the allowance receive HTTP 429. The webhook uses Stripe signature validation in application code. Counters are regional; this is an abuse control, not a globally exact user quota. Application quotas and body bounds remain in place. Shared networks share the allowance.

A bounded live proof sent 128 HEAD requests to a nonexistent API route: 120 returned 404 and 8 returned 429. The landing page returned 200 and webhook HEAD returned 405 during the limit. No customer data was read or mutated. Evidence: private `compliance/evidence/provider-setup/vercel-firewall-runtime-proof.json`, with original and resulting provider configuration alongside it.

Do not enable payload/header logging for authentication, cookies, QR data or submitted messages. Built-in DDoS protection and this custom rate limit do not prove an independent penetration test or enable every managed attack ruleset. Review false positives and legitimate traffic before changing thresholds. Roll back by restoring the saved prior config only after review; disabling the rule weakens protection.

## Account access

- Vercel reports MFA enabled with TOTP for the current operator. Preview deployment SSO protection is enabled. Team-wide MFA enforcement and current access review require their own evidence.
- Cloudflare reports the sole accepted member has Super Administrator access and MFA inactive. User enrollment has been requested in the official authentication page. This is an unresolved production access-control gate.
- GitHub private repository `aegntic/qr-upgrade` exists and its technical CI job passed at 55cffe6. GitHub rejected branch protection with HTTP 403 because the account needs Pro for private repositories. No protection or independent reviewer approval is claimed. The private repository has not been made public to avoid that restriction.
- Stripe live dashboard reports an active merchant account. The operator completed identity verification and the approved restricted server key was privately stored. Readback confirms Customers, Checkout Sessions and Customer Portal Write, and Products, Prices and Subscriptions Read; all other permissions are None. The dedicated live portal permits cancellation at period end and disables product changes. Runtime connection and the live webhook remain pending; no live billing activation or charge is claimed.

## Commercial hosting decision

The current Vercel team is on Hobby. Vercel restricts Hobby to personal non-commercial use. The owner chose migration to the existing Cloudflare account, where Workers Paid is already active. Runtime and cutover checks remain required; no Vercel upgrade has been purchased.

References: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting, https://vercel.com/docs/limits/fair-use-guidelines. Read the current provider terms before purchasing or changing plans.

## Operator workstation observation

Read-only block-device inspection shows the current QR Upgrade workspace under `/home` and the root filesystem mounted through a LUKS-encrypted device mapper. Other mounted volumes are not covered by that observation. Kernel reported Linux 7.1.8-arch1-3 on Omarchy 4.0.3. This is evidence of encryption for this workspace, not a complete device inventory or proof of current patches, malware protection, screen locking, recovery-key custody or offboarding. GitHub user API did not expose MFA status with the current token. A later authenticated official security-page read confirmed two-factor authentication enabled, an authenticator configured, and two passkeys with passkeys preferred; recovery-code custody remains unverified. Private sanitized receipt: `compliance/evidence/provider-setup/endpoint-sanitized.json`.

## Operational alerting observation

The Cloudflare account currently has three enabled generic notifications: web analytics metrics, image transformation quota and an auto-created budget alert. None proves QR Upgrade availability/security monitoring or a delivered responder alert. Its available API alert types include Workers Observability policies for firing/resolved states. Recipient addresses were not copied into evidence. Worker invocation logging remains disabled; enable only reviewed redacted instrumentation, not full request/header/payload logging. Provider documentation supports disabling invocation logs independently of custom logs, with retention dependent on account plan. This does not establish that logs/alerts are configured or operationally approved.

## Approved hosting migration
The owner chose Cloudflare web hosting. Official Billing → Subscriptions shows Workers Paid and R2 Paid active; Workers account settings returns the standard usage model. No new plan was purchased. Migration/runtime/edge verification is pending; the current Vercel service remains live until cutover. Private sanitized receipt: `compliance/evidence/provider-setup/cloudflare-hosting-plan.json`.

## GitHub plan limitation verified
GitHub Pro permits protected branches on private repositories, but GitHub documentation limits environment required-reviewer gates on Free/Pro/Team to public repositories. Do not describe a Pro upgrade as delivering both controls. Keep the repository private and production credentials out of unprotected Actions environments; the final deployment approval design and a distinct human approver remain outstanding. Sources: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments and https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches .

A smaller candidate design is Pro private branch protection with independent pull-request approval, required checks, a production environment restricted explicitly to the `main` branch, and deployment secrets stored only in that environment. GitHub documents private deployment-branch restrictions and environment secrets on Pro. This would put review at the protected source change rather than claim a native private environment approval button. It is a proposed design, not configured protection; a named independent reviewer, actual plan upgrade, exact-commit evidence verification and restricted deployment workflow remain required. Do not use “protected branches only” without a verified protection rule, because GitHub allows all branches when no protection exists.

## Additional local endpoint preflight

An isolated package-index check reported six available updates and no update among the specifically selected infrastructure package names. No package was installed or changed. The accessible environment reports UFW active; its rules require root access and were not inspected. The specifically checked screen-lock processes/configuration were not available, so automatic locking remains unverified. Auditd was inactive; this does not establish whether another audit/endpoint service exists. Scope is this accessible execution environment, not every operator device. Sanitized receipt: `compliance/evidence/provider-setup/endpoint-preflight.json`.

## Google closure confirmation capability

The actual Google Auth Platform Settings page disables session-age/authentication-strength claims while this client remains in Testing. Google's Security Bundle documentation requires production publication, verification and claim opt-in. It also explicitly states that Google Account reauthentication requests are unsupported. Account closure therefore uses the reviewed purpose-bound application OAuth confirmation design, not a claim of forced fresh Google password/MFA authentication. Source: https://developers.google.com/identity/siwg/security-bundle .

## Alert sender domain

The owner approved the six mail-authentication DNS records for `alerts.qrupgrade.com`. The official Cloudflare sending-domain overview now reports Enabled and DNS Configured, with zero sends observed. This does not change the website or main-domain mail routing. Domain activation is not proof of alert delivery, monitored services, approved recipients or responder ownership. No message was sent by the agent. Private sanitized receipt: `compliance/evidence/provider-setup/cloudflare-email-active.json`.

## Isolated preview and operational verification, 21 September 2026

The reviewed Cloudflare build is deployed to `preview.qrupgrade.com` behind the approved single-account email Access rule. Anonymous page/API requests redirect to Access, and alternate Workers.dev addresses return404. An authenticated Chrome session reached the landing page, generator and exact-image Scan Lab. These checks did not attach live Google or Stripe credentials. The preview currently predates the final logo/release build.

The separate private operations Worker stores only fixed component/route/status/outcome classes, counts and timestamps in its own D1 database. A deliberate staging-only missing-AI fault opened the service probe and both runtime monitors through actual Cron and Tail events. AI binding was restored; all four monitors reached healthy after the prescribed quiet period. A fixed fake email sink then rejected one delivery attempt; the real hosted queue released its lease and scheduled the five-minute retry. Normal staging source was restored with sending disabled, and all eight synthetic records were marked terminal to prevent later delivery. No real email binding was invoked in that test. Alert sending remains disabled pending explicit delivery authorization. Queue bounds, transaction rollback and concurrent lease rejection were exercised against the isolated hosted database; sender/recipient restrictions were confirmed in the deployed binding configuration; actual mail rejection/delivery and responder ownership remain separate gates.

A real Google sign-in and fresh purpose-bound closure confirmation completed through the already approved localhost callback against the hosted staging service. Final closure was canceled. Sign-out-everywhere advanced the hosted account generation; a correctly signed old-generation test session returned401 while a current-generation session returned200. This does not establish public consent publication or final production-origin sign-in.

A 21 September follow-up still found Cloudflare’s sole accepted Super Administrator without MFA. GitHub’s official security page confirmed MFA enabled. No credentials, recovery codes or security settings were changed; sanitized receipt: `compliance/evidence/provider-setup/provider-mfa-followup.json`.
