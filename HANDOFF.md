# QR Upgrade — start here

Updated 22 September 2026. This file is the cross-platform coding handoff. No Codex-specific tooling is needed to edit this Next.js/React/TypeScript app.

## Open the correct project

Repository: https://github.com/aegntic/qr-upgrade
Live website: https://qrupgrade.com

**For editing the current live website, start with `release/landing-refresh`.**
`implementation/workflows` contains broader account, billing, Cloudflare, mobile and compliance development. Do not deploy that entire branch over production without reviewing its additional gates.

On the original machine, open these folders in VS Code, Cursor, Windsurf, Claude Code, or any other editor:
- `/home/ae/Projects/QR-Upgrade-Live` — isolated public release source, branch `release/landing-refresh`.
- `/home/ae/Projects/QR-Upgrade` — complete development checkout, branch `implementation/workflows`, INCLUDING unfinished uncommitted work.
- `/home/ae/Projects/QR-Upgrade-Handoff` — local backup of pending tracked changes and untracked files. This backup is not a deployment or a tested commit.

These two project shortcuts are symlinks to the existing repositories. They share Git history but have separate working directories. Avoid opening both for simultaneous edits to the same feature.

On another machine:
```sh
git clone --branch release/landing-refresh https://github.com/aegntic/qr-upgrade.git
cd qr-upgrade
npm ci
npm run dev
```
Use Node 22.13+ (local validation used 22.23.2). Open http://localhost:3017. Existing machine already has dependencies; no installation needed there. Keep secrets out of chat and source. Read `.env.example` for names; request existing secret-manager access only for backend work. Basic landing edits do not require production credentials.

## Current live release

- Vercel project: `qr-upgrade`, scope `aegntics-projects`; Cloudflare manages DNS.
- Deployment: `dpl_zvey1Abv3zG9CrU7abyU5LXp44uh`.
- Candidate URL: https://qr-upgrade-el9iulkov-aegntics-projects.vercel.app
- Public implementation commits: `182312c`, `6e38c26`.
- Development equivalents: `4fb1878`, `da23c24`.
- Main/root hero now starts with the X steel QR, unframed; four material buttons update image and creation link. Destination shortcuts, material studies, scan workflow, campaign examples and FAQ follow.
- Latest logo is `/public/brand/qr-upgrade-logo-v3-*`.
- Public site inspected after promotion; no captured browser console errors. Desktop 1265×714 and mobile 390×844 checked locally.

## Where to edit

| Area | Files |
|---|---|
| Landing layout / metadata | `src/app/page.tsx` |
| Hero images, material choices, primary CTA | `src/components/artwork-exhibition.tsx` |
| Destination shortcuts, studies, kit preview, FAQ | `src/components/landing-sections.tsx` |
| Landing CSS | `src/app/landing.css` |
| Shared header / footer / logo | `src/components/brand.tsx` |
| Global aesthetic / tactile controls | `src/app/obsidian.css`, `src/app/metal.css` |
| Shader, motion pause, reduced motion | `src/components/motion-system.tsx` |
| Generator entry / editor | `src/app/generator/page.tsx`, `src/components/generator-studio.tsx` |
| Destination icons | `src/components/destination-icon.tsx`, `public/destination-icons/` |
| Brand artwork | `public/brand-studies/` |
| Campaign assets and generation | `public/campaign-preview/`, `src/lib/browser-campaign-kit.ts` |
| Shared QR logic | `shared/` |
| Native apps | `mobile/` (read its own AGENTS.md) |
| Operations monitor | `workers/operations/worker.ts` in development branch |
| Launch/compliance evidence | `compliance/`, `docs/implementation/2026-09-20-public-launch.md` |

**Important contract:** preserve `<main id="main" class="foundation-page">` in the landing output. The operations monitor checks this exact marker, plus canonical identity. The redesign wraps its content in `.landing-home` inside it. Changing the marker without coordinating the monitor causes false outage alerts.

## Product direction / constraints

Custom artistic QR IMAGES, with convincing 3D-looking glass, steel, ceramic and sculptural surfaces. Not ordinary QR codes on coloured backgrounds, and not downloadable 3D models. X artwork must remain first. Obsidian/glass/steel, backlighting, tactile metal controls; no return to the old green theme. Prefer sourced branded glass icons. Keep accessibility and reduced-motion support.

Check exact decoded destination before exports; do not imply every AI image automatically scans or that a digital score guarantees printed performance. Campaign kit contains social/print assets, scan report and guide. Hero-video production is deferred until brand/aesthetics are agreed. Latest landing uses explicit material selection, not an automatic carousel; older README descriptions of the carousel are superseded.

## Verify and publish a focused public change

```sh
npm run typecheck
npm test
npm run build
```
Latest results: 159/159 public-branch tests; 356/356 development tests; public production build and type checks pass. No project `lint` script exists. On original machine use approved PATH `oxlint --resolve`, then `oxlint -- 'explicit/changed.tsx'`; no automatic installs/fixes. Shared lint guidance is `/home/ae/.agents/AGENTS.md` if available. On another platform report missing supplemental tooling rather than silently fetching it.

Only after local checks and desktop/mobile visual checks:
```sh
vercel deploy --prod --skip-domain --yes --no-wait --scope aegntics-projects
vercel inspect <returned-deployment-url> --scope aegntics-projects --wait --timeout 60s
vercel curl / --deployment <returned-deployment-url>
vercel promote <returned-deployment-url> --yes --scope aegntics-projects
```
Verify the public domain after promotion. Keep the previous deployment as rollback. Explicit scope matters: an unscoped deploy returned Not authorized despite a valid login. Candidate URLs require Vercel authentication; the public domain does not. Do not weaken preview protection to test it.

## Unfinished work: do not mark complete without evidence

- Development checkout has pending marketing/share-card/press/SEO changes from another workstream. They are deliberately not included in the landing deployment. Inspect `git status` and the local backup before editing; never discard them.
- User prefers eventual Cloudflare hosting. Current public site remains on Vercel. Migration is separate work: check runtime, sessions, webhook verification, private caching, DNS and rollback before switching.
- Account/public Google sign-in, live billing and compliance launch controls require fresh end-to-end evidence; this landing release did not re-certify them. Read current compliance records and implementation plan rather than relying on historical chat claims.
- “Enterprise compliant” or “Vanta equivalent” is NOT a certification. Owner/manual/device/auditor gates must stay honest. No broad claim that all controls passed.
- Android/iOS source exists; JS bundles are not signed store releases. Apple developer account remains unavailable per user. Verify current Android build artifacts and device behavior separately.
- Further visual/flow refinement should be based on actual screenshots and working editor clicks. Keep changes small and independently deployable.

## Session recovery

Browser automation works after desktop restart. A Codex launcher stdout/protocol issue was previously fixed on this machine; do not re-run Cloudflare authentication loops for it. Native browser tools are optional: other platforms can use their normal Playwright/browser tooling. Local preview starts with `npm run dev`; restart stopped that process previously.

Private credentials are intentionally excluded from this document, Git and the handoff backup. Existing local secret files must remain private. Read-only mirrored project `sources/` must not be edited.
