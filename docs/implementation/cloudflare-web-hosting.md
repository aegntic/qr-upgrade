# Cloudflare web hosting

The web application uses Next 15.5.25 with OpenNext 1.20.6 and Wrangler 4.135.0. The existing QR service remains a separate Worker and owns D1, R2 and AI. This migration changes the web runtime only. It does not attach a domain, publish a version, activate billing, configure secrets or migrate storage.

Use Node 22.23.2 (`.nvmrc`) and `npm ci --ignore-scripts`. `rclone.js` remains pinned to 0.6.6; its ZIP dependency has a scoped `adm-zip: 0.6.1` override for the upstream memory-allocation and symlink-extraction advisories. No app framework or Stripe upgrade is included.

## Commands and artifact boundaries

- `npm run build`: the existing Next build contract, including Vercel rollback.
- `npm run cf:build`: creates the OpenNext output and invokes the same Next build.
- `npm run cf:dry-run -- --outdir <temporary-directory>`: bundle/size validation only, without publishing.
- `npm run cf:preview`: local Workers preview of the existing output. For isolated proof use T14 below, which substitutes a local fixture for the service binding.
- `npm run cf:typegen`: binding declarations only. Run in a clean copy without local runtime files; commit the resulting declarations, never secret values.
- `npm run cf:upload`: uploads the already-built version without promoting traffic. Root performs this only after the clean-output and staging gates pass.
- `GITLEAKS_BIN=<installed-gitleaks> npm run security:cloudflare`: repeatable T14 clean build, output scan and actual local workerd proof. `-- --keep` retains only synthetic temporary artifacts for diagnosis.

Build in a fresh temporary copy or checkout containing only source/configuration and public assets. Never build the upload with `.env.local`, `.dev.vars`, provider credentials, mobile signing material, research or compliance evidence present. T14 uses an explicit copy allowlist and a scrubbed child environment, performs a clean install, and gives the build synthetic secret canaries only. Its runtime fixture keys are generated after output scanning and are never added to the uploaded assets. `.open-next`, `.wrangler` and local runtime variable files are ignored; generated output and `.dev.vars*` do not change the security evidence source digest. `cloudflare/` remains inside the SAST/source boundary.

T14 scans the entire generated adapter tree and dry-run upload with Gitleaks, without excluding directories. The only generated rules allow the three exact Next-created server-action/preview keys read from the clean-build manifests and the exact React `keyPath`/`implicitSlot` and Stripe idempotency-key property-assignment expressions. It separately rejects those keys in all public assets, rejects runtime canaries everywhere, and rejects private-file paths. Root must separately fingerprint private real secrets against the candidate output before upload. T08's ordinary Next build and T11's Node HTTP check remain required rollback coverage.

## Runtime behavior

`cloudflare/worker.ts` wraps OpenNext. All asset requests run through the wrapper first, preventing an asset path from bypassing API policy. The single `API_RATE_LIMITER` binding provides 120 requests per 60 seconds per hashed network identity. Production namespace is `2026092001`; staging reserves `2026092002`. These IDs were checked against all deployed Workers before assignment. Only exact `POST /api/billing/webhook` is exempt; other methods, API 404s, encoded paths and slash variants enter the bucket. Missing or malformed provider IP, missing limiter and limiter exceptions fail closed. Responses are bounded, no-store, and carry the existing security headers. Cloudflare's limiter is location-local and eventually consistent: it is an abuse control, not a global quota or billing meter. Existing upstream quotas remain authoritative.

The top-level Worker validates `CF-Connecting-IP`. An AsyncLocalStorage entry shares the validated identity and runtime bindings with the separately bundled Next application, using a stable global symbol for the store and a separate context per request. Browser headers cannot create this context. Art and public forms hash this trusted identity before service calls; no raw IP is forwarded to the service. The explicit local test identity works only on localhost/127.0.0.1. Node development retains its fixed local identity. Vercel rollback accepts its replaced provider header only when the trusted deployment environment has `VERCEL=1`; Cloudflare always takes precedence over Vercel or caller hints.

All QR-service requests use `cloudflare/service.ts`. A service binding is preferred, an explicitly injected fetch is preserved for tests, and URL fetch remains available for local/Vercel rollback. Every transport sets the same bearer authorization, leaves account/session/owner checks in place, preserves deadline/cancellation and streams binary response bodies. Route-specific error mapping remains with existing handlers. The web Worker has no direct D1, private R2 or AI binding. Runtime configuration is resolved per request, avoiding module-initialization capture. Google/Stripe callbacks and production origins remain `https://qrupgrade.com`; staging and workers.dev are not added to production origins.

Stripe uses its Fetch HTTP client and asynchronous signature verification. Raw-body bound, five-minute tolerance, mode validation, recognized event allowlist and durable write-before-ack remain unchanged. The Open Graph image runs with the supported Node runtime. HTML still uses the existing strict nonce CSP; no inline-script bypass is added. APIs and public content reads/redirects remain no-store. Static `_headers` applies the baseline security policy, revalidates stable-name artwork, and marks hashed `/_next/static/*` assets immutable.

## Staging, promotion and rollback

The checked-in Worker is `qr-upgrade-web`, with Workers.dev and preview URLs disabled, observability explicitly disabled, `keep_vars: true`, no custom domain/routes, and only ASSETS, API_RATE_LIMITER and the authenticated QR_SERVICE binding. No ISR, R2 cache, queue, tag cache or private storage is configured.

Root creates a distinct Access-protected staging Worker/hostname with the reserved staging namespace and isolated service state. If isolated provider dependencies are unavailable, leave those features unconfigured and verify failure behavior. Never bind production service data or credentials to an unprotected preview. Capture runtime-secret names through protected configuration; do not put their values in build variables or repository files. Preserve billing and scan activation gates.

After T14, source review and protected-staging proof pass, upload an immutable candidate version and record its version ID, source digest, asset manifest and evidence. Promote that exact reviewed version with Wrangler's versions deployment workflow. Upload does not imply approval to attach the apex. Root records current DNS/Vercel state, resolves the provider/MFA and privacy-safe monitoring gates, then controls the explicit Custom Domain cutover. Keep apex callbacks unchanged and configure www as a redirect to the apex.

Retain the existing Vercel deployment and service URL fallback throughout the rollback window. A Worker version rollback restores web code only. A hosting rollback also requires detaching the Cloudflare Custom Domain and restoring the recorded DNS and Vercel domain configuration. No storage changes are part of this task. Separate account-closure backend migrations must be deployed in their already-reviewed order.

T14 also records Wrangler’s local startup profile. Local workerd proof establishes runtime compatibility, not deployed startup time, CPU/memory limits, real Google OAuth, live payment behavior, Access isolation or production cutover. Root owns browser CSP/visual proof and actual staging/provider checks. Observability remains disabled until the next bounded privacy-safe telemetry task establishes useful redacted monitoring.

## Primary references

- [OpenNext setup](https://opennext.js.org/cloudflare/get-started), [custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker), [runtime variables](https://opennext.js.org/cloudflare/howtos/env-vars), [Stripe](https://opennext.js.org/cloudflare/howtos/stripeAPI).
- [Cloudflare limiter semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [current platform limits](https://developers.cloudflare.com/workers/platform/limits/), [static headers](https://developers.cloudflare.com/workers/static-assets/headers/), [version promotion](https://developers.cloudflare.com/workers/versions-and-deployments/), [local startup profiling](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
- [adm-zip 0.6.1 changes](https://github.com/cthackers/adm-zip/releases/tag/v0.6.1).
