# QR Upgrade workflow completion

## Global Constraints
- Preserve the obsidian, glass and steel visual language and existing glass icons.
- The core output is a custom QR image. Test and export the exact composed artifact.
- Never put destination contents, Wi-Fi credentials or portraits in navigation URLs.
- Saving locally is explicit; explain browser/device lifetime. No automatic persistent storage of sensitive drafts.
- Downloads must wait for uploads and current rendering/validation. Never export stale artifacts.
- Hosted services use the user's Cloudflare account. Do not claim accounts, AI generation, analytics or compliance work without functioning, verified infrastructure.
- sources/ is read-only. Preserve unrelated work. Workers do not spawn subagents.

## Interfaces and sequence
| Tasks | Shared boundary | Decision |
|---|---|---|
| 1 → 2 | Content, DestinationId | Expand Content with optional fields; preserve existing required fields/call sites. Export contentTypeForDestination. |
| 2 → 3 | Draft and artifact | Versioned EditorDraft; pass exact svg/png/text/size in memory, never reconstruct when entering Lab. |
| 3 → 4 | Image adjustments | Optional parameters/default identity, rendered artifact key includes every edit. |
| 4 → 5 | Hosted architecture | Keep private local drafting working independent of Cloudflare. Real cloud capabilities gated by deployment configuration. |

## Task 1: Structured destination families
Expand shared QR payloads with text, phone, SMS, email, WhatsApp, location and event. Enrich Wi-Fi encryption/hidden-network and vCard organisation/title/site/address. Validate inputs/escaping and preserve old callers. Add catalog entries and reusable DestinationFields component. Root integrates it into generator and searchable picker. Test representative payloads and malicious controls/date/URL cases.

## Task 2: Connected local workflow and saved designs
Shared in-memory draft and exact-artifact handoff; generator → Scan Lab → resume editor. Explicit IndexedDB save; local design list with search, rename, duplicate, archive/restore and revision history. Sensitive local persistence disclosure. Clear error/recovery states. Mobile-friendly navigation.

## Task 3: Composition and export controls
Search/filter artworks/templates, full-size accessible preview, image crop/zoom/position/brightness/opacity, centre-image framing, caption composition, export filename and JPG/WebP. Revalidate every complete image; preserve existing vector export when no raster composition needed.

## Task 4: Cloudflare service implementation
Inspect authenticated account and provision only project-specific resources. Prefer Workers AI image generation, D1 ownership/job metadata and R2 assets. Accounts require a real identity provider, no invented credentials or insecure fallback identity. Build deployable service, auth and quota contracts; connect only verified live integrations. Report concrete infrastructure blocks. Hosted content/dynamic routes follow authenticated persistence rather than unauthenticated public write endpoints.

## Task 5: Review, evidence and deployment
Run tests/typecheck/build and meaningful browser journeys with screenshots. Verify saved/resumed artwork, upload races, mobile navigation and actual exported files. Review security/correctness. Deploy working web changes to existing Vercel project/domain; verify live. Native changes depend on shared schema compatibility and existing release gates, not a claim of signed app delivery.

## Preflight self-consistency
Task 1 leaves generator integration to root and keeps older API Content valid. Task 2 uses explicit persistence instead of autosaving credentials. Task 3 identities default to existing rendering and invalidates checks. Task 4 depends on available access and cannot block local work. Task 5 claims only measured results. Optional reference barcode/Magics/billing breadth is outside the core audit's implementation priorities.
