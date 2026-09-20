# QR Upgrade

A working product prototype for **qrupgrade.com**, with a Next.js website and an Expo app targeting Android and iOS. Create an artistic QR image where the artwork itself carries a destination, validate it, and export the image without an account.

## Deliverables

| Deliverable | Location | Status |
|---|---|---|
| Responsive website + studio | `src/`, `public/` | Production build verified; browser walkthrough verified |
| Android app | `mobile/app/`, `mobile/android/` | Native project generated; Android Hermes bundle exported |
| iOS app | `mobile/app/`, `mobile/ios/` | Native project generated; iOS Hermes bundle exported |
| Shared QR/checklist engine | `shared/` | URL, Wi-Fi, vCard, artwork integration, decoding and repairs |
| Mobile screen preview | `mobile/dist/` | Browser preview of the native screen components |
| Appllama design research | `research/appllama/patterns.md` | 28 reference screens reviewed; no competitor assets shipped |

**These are source projects and compiled JavaScript bundles, not signed APK/AAB/IPA releases.** This Linux host has no Android SDK, attached device, or iOS simulator/Xcode. Native camera, photo-picker, PDF and share-sheet behavior needs device verification. No store submission has been performed. The web app is deployed at https://qrupgrade.com and https://www.qrupgrade.com on Vercel; native signing and device validation remain pending.

## Web visual system

The website uses obsidian surfaces, smoked glass and steel controls, with live WebGL backlighting, a 14-piece artwork hero, pointer-responsive lighting, and motion pause/reduced-motion support. The generator retains the baseline creation modes and export checks. See `DESIGN.md` and `research/design/claude-design-2026-09-18.md` for the implemented system and research. This visual pass targets the web app.

## Live website

Production: **https://qrupgrade.com**. The `www` address also serves the site. Hosting is the Vercel project `aegntics-projects/qr-upgrade`; DNS stays with Cloudflare. `SCAN_API_ENABLED=false` is set for production. Internal evidence, research and native projects are excluded from deployment through `.vercelignore`. Deployment details and verification are recorded in `research/deployment/launch.md`. This publishes the public browser editor; it does not certify the pending enterprise controls.

## Run the website

Use Node.js 22.13+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open <http://localhost:3017>. For production: `npm run build`, then `npm start`.

`npm test` runs decoder round trips for every content/style combination, malformed-input checks, print repairs, and API boundary checks. `npm run typecheck` checks TypeScript.

## Run Android or iOS

```sh
cd mobile
npm ci
npx expo start
```

Open with a compatible Expo Go client or create a development build. To compile native projects locally, install the matching Android SDK or Xcode/CocoaPods, then use `npm run android` or `npm run ios`. iOS compilation requires macOS.

```sh
npm run typecheck
npm run export
npm run prebuild
```

`expo export` writes Android and iOS Hermes bundles, mobile web assets and an asset map into `mobile/dist/`. It does **not** produce an installable app. `expo prebuild --no-install` regenerates `android/` and `ios/` from `app.json`.

`mobile/eas.json` includes a preview APK profile, an iOS simulator profile and production profiles. Once an Expo account/project and signing credentials are configured, run `npx eas-cli build --platform android --profile preview` or `npx eas-cli build --platform ios --profile preview`. Store releases need the production profile and the user's developer accounts. Package/bundle ID is `com.qrupgrade.app`; confirm availability before store submission.

To preview the mobile screens without a device:

```sh
cd mobile
npx expo start --web
```

The browser adapter supports PNG download. PDF sharing uses the native modules; the full Next.js web studio also supports PDF download.

## What works

The web-only `/brand-studies` gallery adds 14 unofficial visual experiments for LinkedIn, Amazon, Snapchat, Instagram, TikTok, YouTube, Spotify, WhatsApp, Discord, Telegram, Pinterest, X, Google Maps and Facebook. Each uses an ordinary QR linking to the platform homepage, not a proprietary native sharing code. Download the verified PNG or choose **Try your own link** to open its artwork in the studio. Changing the URL triggers fresh validation. Generation prompts: `research/brand-studies/prompts.md`. These studies are separate from the 14 original directions and the deferred hero-video task.

- 14 AI-created artwork directions: dragon, koi, coffee, mountain landscape, tiger, orchids, city, turtle, citrus, planet, vinyl, fox, ocean wave and botanical illustration.
- The hero cycles through actual artistic QR images with pause/previous/next and reduced-motion support.
- Choose an artwork or upload your own image; encode a URL, Wi-Fi network or vCard into its pixels locally. This is deterministic image integration, not runtime AI inference.
- Adjustable scan strength preserves artwork detail while protecting QR sampling points. Repair increases protection and print width without weakening the selected test conditions.
- Web export requires exact-content decoding of the artwork, a 256-pixel reduction and a controlled scan simulation, plus physical-size checks. Changed inputs immediately invalidate stale results.
- Native screens use the same artwork integration and verify the captured image before export. Device testing remains required.
- PNG and RGB PDF export include the artwork and quiet zone. Captions and context scenes are outside the exported image.
- Web controls use brushed/polished metal surfaces, edge glow, text sheen and a short press-in with a soft return.

## Scope and limits

**Live prompt-to-image generation is not connected.** The example artwork was generated during development using imagegen with a QR structural reference. See `research/qr-art/prompts.md`. A production model service with structural conditioning, job management and output validation is still needed for new AI artwork on demand. The present custom-image workflow integrates an uploaded image locally; it does not reimagine its subject with AI.

Working images are 768px square on web and 512px on native. Higher-resolution exports resample the working image. A passing decoder is not a universal print guarantee. Scene previews do not analyze surface lighting, glare, perspective or curvature. Print a physical proof and test several phones.

Dynamic links, GEO routing, saved brand kits, accounts, analytics, billing, tenant APIs and cloud sync are not connected. Drafts live in memory. Wi-Fi credentials are intentionally readable from the QR. User images and content are processed locally; no runtime model receives them. Native processing/check/export temporary files are cleaned after operations, but crashes can leave cache files.

## Public discovery and API

The website includes relevant Organization, WebSite and SoftwareApplication JSON-LD; canonical metadata; Open Graph image; `robots.txt`; `sitemap.xml`; `/llms.txt`; `/llms-full.txt`; `/ai`; and a methodology page. Public facts come from `src/lib/facts.ts`. No fabricated reviews, ratings or unsupported claims of AI indexing are included. `llms.txt` is optional; it does not guarantee ranking or citations.

`POST /api/v1/scan` is disabled by default. Explicit activation requires a server-side bearer secret of at least 32 characters and a working centralized Redis quota. Missing protection or a limiter outage fails closed. It accepts up to 4 KiB of JSON print parameters:

```json
{"foreground":"#193c2f","background":"#ffffff","quietZone":4,"sizeMm":40,"distanceCm":40,"modules":29}
```

It returns the checklist and `decoderTested: false`. It accepts no image and is not an image-decoding service. Before public production use, verify deployment WAF limits, credential management and central monitoring. See `.env.example`; never put the service secret in a public/mobile bundle.

## Architecture

- Next.js 15 / React 19 / TypeScript for the public site and web studio.
- Expo SDK 57 / React Native 0.86 / Expo Router for Android and iOS.
- `shared/qr-art.ts`: pixel-level artwork integration; `shared/qr.ts`: payload encoding and reference geometry; `shared/score.ts`: print checks and repairs; `shared/decode.ts`: bounded multiscale jsQR decoding.
- Platform adapters handle canvas/export on web and camera/files/share sheets on native.
- No duplicate Fabric/Konva scene engines or unneeded backend. This keeps the first creation loop inspectable and usable without external credentials.

## Verification

See [verification.md](verification.md) for results and remaining native release checks. Both dependency trees reported zero known vulnerabilities in `npm audit` on 18 September 2026. Mobile overrides pin patched `decode-uri-component` and `uuid`; review these when upgrading Expo.

## References

- [DENSO WAVE: QR area and quiet zone](https://www.qrcode.com/en/howto/code.html)
- [Google: AI features and websites](https://developers.google.com/search/docs/appearance/ai-features)
- [llms.txt proposal](https://llmstxt.org/)
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [node-qrcode](https://github.com/soldair/node-qrcode) and [jsQR](https://github.com/cozmo/jsQR)

## Enterprise security and release readiness

[Read the enterprise control guide](compliance/README.md). `npm run security:evidence` runs 13 technical gates and produces private evidence. `npm run compliance:release` requires fresh source-matched results plus independently approved organizational controls. Missing, stale or changed evidence blocks release. The CI workflows are prepared but not connected to a remote repository. No SOC 2 attestation, ISO certification, legal compliance status or production deployment is claimed.

Web HTML uses per-response CSP nonces and private/no-store responses; this trades shared-page caching for script restrictions. Inline CSS remains allowed for interactive scene styles. The optional API is now authenticated, centrally rate-limited and bounded by body size/time. Native configuration disables Android backup/cleartext and removes automatic debug signing for release; a final signed binary still needs device/security review.

## Centre profile portraits

Web, Android and iOS source now support an optional locally selected profile photo, cropped into a central circular portrait with a brushed-metal surround. Portrait size is adjustable from 10–24% of the image width. Changing or removing the portrait invalidates earlier verification. Export checks the actual composed image, including the portrait; repair can shrink the portrait and strengthen the QR sampling regions. Finder/alignment function pixels remain protected. Real device testing is still required before release.

Review the X portrait example at `/generator?brand=x&portrait=sample`; the example person is fictional and AI-generated. `public/brand-studies/x-portrait.png` decodes to the public X homepage at 184, 256, 512 and 768 pixels. It is an unofficial study, not a personal profile or platform endorsement.

## Current baseline

The homepage and `/generator` now use the PDF reference's functional structure while retaining QR Upgrade's own visual identity: Custom QR / Image QR / QR Art, destination shortcuts, Designs / Logo / Style, persistent live preview, gated PNG / SVG / PDF export, and the corresponding workflow / examples / features / QR types / FAQ sections. See `research/baseline/reference-map.md` for exact scope and the reference features that still need backend services. Native source remains at its existing image/art creation flow pending baseline adaptation. Hero film and extra feature work remain deferred.
