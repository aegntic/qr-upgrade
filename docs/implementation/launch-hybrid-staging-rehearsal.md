# Launch hybrid staging rehearsal

Status: prepared locally, not uploaded. No staging or production deployment, merge, Builds connection, Google client registration or credential change is authorized by this document.

## Candidate and local evidence

Candidate is fix/launch-gates based on PR14 commit d33e61db4f3ebec0586c9a02713031b038e5ec4b. It selectively restores showcase/share-card and /press while preserving current account, session, privacy, service and billing controls. No service mutation is part of this launch patch.

Fresh local checks on 10 October 2026:

- Exact Node 22.23.2 from .nvmrc, official release SHA256 checked.
- Gitleaks 8.30.1 official release SHA256 checked.
- Typecheck passes with NODE_OPTIONS=--max-old-space-size=4096. Default local heap exhaustion was not a TypeScript diagnostic.
- Tests: 361 passed, zero failed/skipped.
- Next/OpenNext build passes. A dependency duplicate-case warning remains non-fatal.
- Staging-only Wrangler dry run passes, with qr-upgrade-service-staging binding, staging operations tail, billing disabled and remote Scan API disabled. No upload.
- Source/config/assets/test scan: no findings. Fresh generated adapter and dry-run bundle scans: no findings after narrowly allowing only exact manifest-derived Next keys and documented React/Stripe property assignments. Generated server keys do not occur in public assets. Do not broadly exclude generated directories or arbitrary key patterns.

These are scoped checks, not the entire security:evidence/compliance:release gate, genuine Google OAuth proof, current provider rollback proof or phone/print proof. A previous local workerd proof predates this fresh build and must be rerun for exact final-source runtime coverage. A full isolated T14 attempt exceeded its bounded window during clean build; a scoped runtime resume also timed out. Neither is a pass. No final-source runtime success is claimed.

## OAuth gate

The current staging secret-name listing returned only QR_SERVICE_SECRET. GOOGLE_CLIENT_SECRET is absent. GOOGLE_CLIENT_ID was not established by a secret listing because it can be a plain variable. Confirm the current staging client ID, client-secret availability, registered callback and staging-specific canonical-origin design before a genuine sign-in rehearsal.

Do not reuse production credentials by assumption, widen production callback/origin rules, copy credential values into source/logs/artifacts or treat a historical repository approval sentence as permission. Obtain owner confirmation for the isolated staging credential setup. If a secret must be collected, use protected secret storage, not conversation text.

## Rehearsal sequence after separate approval

1. Freeze the exact candidate commit and source digest. Preserve the existing staging config separately; wrangler.rehearsal.json is a staging-only handoff, not a production config replacement.
2. Read current staging web/service version IDs, Access policy, domains, binding and existing rollback pair from the provider. Record them without credentials. Historical version IDs are not current-state evidence.
3. Verify isolated Google credentials and callback/origin behavior, staging access restrictions and production separation. Leave billing disabled and preserve all account/security controls.
4. Rerun exact-source local workerd/API/browser checks and the applicable security evidence gates. Check generated artifact membership and secret fingerprints without disclosing values.
5. Present final candidate, staging destination, verification receipt and rollback pair for explicit approval before any upload.
6. Only after that approval, deploy the web candidate to staging. Do not mutate production/service data or connect Builds. Verify public pages, generator, exact-image local Scan Lab, showcase/share card, /press, account settling, genuine isolated Google sign-in, logout/session behavior and owner isolation.
7. If staging checks fail, restore the verified compatible staging web version. No service/data rollback is part of this web-only patch. Never restore an old database/deletion/session ledger as an incidental rollback.
8. Report exact provider versions, links, checks and remaining gaps. Production promotion needs its own explicit approval and compatible web/service release plan.

## Separate design renderer gate

Glossy icons/QR are on design/icon-family, not installed by this launch patch. QR proof for 29, 45 and 49-module payloads passes original, blur .65 and rotation 8 at 1800/1200/900/600/300px. A 105-module stress payload passes those checks only at 600px and above; blur/rotation at 300px fail. Dense output must therefore enforce a 600px minimum for that measured case, with front-facing pose and an application-level density/size gate. The >73-module pose cutoff is provisional, not an exhaustive density sweep. Native-phone and physical-print checks are untested. Do not claim all payloads are scan-ready.
