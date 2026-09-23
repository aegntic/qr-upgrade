# QR Upgrade growth workspace

**Live status — 23 September 2026:** The owner confirms the updated product is live. A fresh public check verifies methodology, reviewer and privacy pages and updated public metadata. Twelve pages were checked; four notices remain for two sitemap URLs that redirect to noindex account screens. This check does not revalidate every product workflow. Integration dependencies below reflect the 21 September setup and need reconfirmation before being reported as current blockers.

The source now includes a post-export showcase card, factual reviewer page, corrected public metadata and a bounded discovery monitor. `installed-skills.json` records the 67 selected skills and exact upstream revisions. The shared brief is `.agents/product-marketing.md`.

## Run and inspect

`npm run marketing:check` checks the public site's sitemap and a maximum of 30 public pages. `npm run marketing:check -- http://localhost:3017` checks a local server when `QR_GROWTH_STATE_DIR` points to a separate local-test directory. State and the latest change report live under `.agents/loops/discovery/`; they are excluded from Git. The process uses time/size limits, same-origin redirects, a run lock, atomic snapshots and issue IDs. Partial evidence cannot close previous findings. It never edits or publishes the site.

Pause marketing checks by creating `.agents/loops/PAUSED`, or pause the Codex schedule. Delete that file to resume. A stale run lock expires after 20 minutes. Corrupt state requires review rather than silently resetting the baseline. A reappearance after a resolved issue is a new alert.

The installed SEO executable is `~/.local/share/qrupgrade-growth/runtime/node_modules/.bin/seo`; the Newsjack executable is in the same directory. `qrupgrade-seo` is registered as a local Codex MCP server. CLI wrappers live in `~/.local/bin/qrupgrade-seo` and `~/.local/bin/qrupgrade-newsjack`. The SEO wrapper disables optional usage telemetry. Reports remain local. Credentials belong in each tool's secure connection flow, never in this repository.

Claude SEO's source and isolated runtime live under `~/.local/share/qrupgrade-growth/sources/AgriciDaniel--claude-seo`; run its `scripts/claude-seo doctor --json` to check core and browser readiness. Its installed skills have a local path adaptation for this runtime. The AKCodez OpenClaw, iPhone and media-kit source references are beside it. They are not production services. The iPhone tool requires a Mac, Xcode and a connected phone.

## Recurring workflows

| Workflow | Cadence / trigger | Work and output | Act only when / stop rule |
|---|---|---|---|
| Discovery | Daily, 08:00 Sydney | Run `marketing:check`; compare stable issue IDs; confirm new failures. | Notify on new/resolved findings or a changed execution failure. Stay quiet for unchanged state. Pause file stops work. |
| Search and editorial | Mondays, 08:00 Sydney (same daily heartbeat) | Read product context and discovery results; inspect available GSC data; research three dated opportunities; write a source-backed weekly brief. | Use new evidence, complete comparable periods and deduplicated URLs. Missing providers are disclosed, not treated as zero. |
| Demonstration to content | New approved demo | Use `content/launch-pack.md`, the prompt pack and video source to prepare clips, captions, a tutorial and a carousel. | Only verified feature claims and owned/approved assets. Stage drafts; do not auto-publish. |
| Creator case studies | New qualified collaborator | Research fit, prepare a tailored concept and a factual evidence request. | No invented reviews, implied partnerships or automated outreach. |
| Locale/store assets | Confirmed native release and a selected locale | Use ASO, screenshots and local caption variants with actual app captures. | Native signing/device proof and listing access must be available. |
| Paid creative tests | Connected account plus explicit budget | Compare attributable product outcomes and prepare a controlled test. | Spend cap starts at zero. No campaign activation or budget changes from the research schedule. |

State for the weekly review is `.agents/loops/weekly.json`: last successful run, canonical source URLs already used, draft IDs and unresolved connection dependencies. Keep at most 90 days of source keys. A failed run must not advance the successful cursor. Do not store QR payloads, contact credentials, private images or personal browsing history.

## Tracking contract

The client dispatches `qrupgrade:growth` with `{name, version: 1}`. Allowed names: `export_requested`, `showcase_prepared`, `showcase_download_requested`, `showcase_share_opened`, `showcase_share_handoff`, `showcase_share_cancelled`, `showcase_link_copied`. No URL, QR text, image, filename, user ID or browser identifier is included. There is no network collector in this implementation. A future consent-aware analytics adapter can consume the event without inspecting editor state.

These event names are deliberately precise: a download request is not verified file delivery, and a native share handoff is not proof of publication. The return link uses fixed campaign parameters; it contains no per-user referral token. End-to-end funnel and retention reporting remain unconnected until the analytics provider is selected.

## Connected work still needed

- Search Console / analytics: owner-authorized property access, or a supplied export. No authenticated search-performance baseline is currently available.
- SEO-GOD/OpenSEO and Activepieces: Docker engine access is unavailable in this session. SEO-GOD's skill is installed; its container service is not running. The Codex schedule covers the bounded public check meanwhile.
- Higgsfield / ElevenLabs: account access and approved usage allowance for generated video and voice. The local captioned Remotion film does not require these providers.
- NotFair: selected skills are installed; its hosted MCP integration requires the owner's account connection. No remote account data was sent.
- Newsjack: CLI and selected skills work locally. Medialyst and X account connections are not configured; public web research is available as the fallback.
- Native automation: `control-iphone` is available as source. Fastlane 2.240.1 is installed locally; iOS screenshots still need the Mac/signing/device environment and actual store IDs. Do not invent an app listing or signed release.

Before publishing the web changes, build and verify the production adapter against the repository's release process. This workspace does not silently promote a new Cloudflare version merely because a marketing check passes.

## Delivered assets and installation state

`implementation-status.json` records exact readiness and outstanding connections. `video/` contains the reproducible 30-second portrait and landscape film sources and real captured assets; final MP4s are in the dated implementation deliverables alongside complete SEO dispositions. `content/prompt-pack.md` contains the seven product-specific task briefs. Optional Whisper/MediaPipe/OpenCV transcription and face-tracking dependencies are not installed; the captioned Remotion workflow is working.

OpenSEO Compose is prepared in `.seo-god/docker-compose.yml`; `seo-god.json` preserves an incomplete setup. Activepieces is prepared outside the repository at `~/.local/share/qrupgrade-growth/services/activepieces`. Both Compose files validate, but neither service is started because this session lacks Docker socket access.
