# QR Upgrade revenue entry release

Released 2026-11-14 UTC (15 November Sydney). Public URL: https://qrupgrade.com/pricing

## Source and deployment
- Deployed application source: `05af07f115a35d4f969e6ce6ab4ce21b5125b4fe`, branch `improve/revenue-entry-20261115`.
- Cloudflare web Worker: `qr-upgrade-web`.
- New version: `77493a30-291f-4325-a8f2-d9a699399f12`, 100% traffic.
- Prior version verified immediately before upload: `ae19703a-74f4-4044-83e9-a2d206530d0d`.
- Uploaded with `wrangler versions upload --keep-vars`, then `wrangler versions deploy` (not triggers deploy). Existing service binding, rate-limit binding, secret configuration, prices, database, and routes were not changed. No service/database deployment or new billing activation.
- Rollback path: deploy the retained prior web version at 100% using Wrangler versions deploy. No database rollback. Retained provider version verified; rollback was not exercised against live traffic.

## Change
- Real indexable `/pricing` page replacing redirect to private/noindex billing view.
- Pricing visible in desktop/tablet and mobile navigation.
- Anonymous plan cards offer working account sign-in links instead of disabled purchase buttons. Signed-in checkout and subscriber management behavior retained.
- AEGNTIC attribution link in the shared footer. No cross-site tracking or shared customer data introduced.
- Supported Next.js 16.4.6, OpenNext 1.20.17, Wrangler 4.162.0, Node 24.22.1. Explicit exact-path asset handling required by current adapter.
- Scoped glob/minimatch patches address build-tool advisories. Artifact scanner recognizes only two verified compiled-code false-positive assignments; default secret detection and canary assertions remain intact.

## Verified
- 368/368 automated tests, typecheck, check-only supplemental lint and diff whitespace check.
- Next/OpenNext production build and Cloudflare dry-run.
- npm audit: zero vulnerabilities at release time.
- Local production HTTP nonce/no-store/browser-security checks.
- T14 clean-build artifact secret scanning, canary exclusion, workerd SSR/nonce/API rate-limit boundaries, account fixture, service binding and async signed Stripe webhook proof.
- Local desktop and 390px mobile pricing layout; mobile menu closes after selecting Pricing.
- Live browser: pricing headline and navigation; existing USD $12/month Pro and $25/month Brand capacities; new Pro sign-in action reaches account page with Google sign-in available; AEGNTIC footer; generator default artwork reports 4/4 scan checks.

## Limits
No real payment, OAuth account completion, native store release, physical print test or enterprise certification was performed. Python HTTP probes on the desktop received 403; live browser verification succeeded. Bundled third-party duplicate-case/nullish warnings and the middleware convention deprecation remain. GitHub main and older Vercel history are stale relative to this production lineage; do not deploy them over current production.
