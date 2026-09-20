# Logo v3 surfaces report

## Status

Complete. The v3 mark is active in the web header/footer, browser icons, hosted-page credit, native root header, app-switcher privacy cover, native icon/favicon and splash. The prepared static 1200×630 social card now uses Next's metadata image convention, and `/opengraph-image` remains compatible through a narrow rewrite.

Changed files:

- `mobile/app.json`
- `mobile/app/_layout.tsx`
- `mobile/assets/icon-v3.png`
- `mobile/assets/mark-v3.png`
- `mobile/assets/splash-v3.png`
- `mobile/package-lock.json`
- `mobile/package.json`
- `mobile/src/privacy-cover.tsx`
- `next.config.ts`
- `public/brand/qr-upgrade-apple-v3.png`
- `public/brand/qr-upgrade-logo-v2.png`
- `public/brand/qr-upgrade-logo-v3-128.png`
- `public/brand/qr-upgrade-logo-v3-256.png`
- `public/brand/qr-upgrade-logo-v3-32.png`
- `public/brand/qr-upgrade-logo-v3-64.png`
- `public/icon.svg`
- `src/app/layout.tsx`
- `src/app/opengraph-image.jpg`
- `src/app/opengraph-image.tsx` (removed)
- `src/app/services.css`
- `src/components/brand.tsx`
- `src/components/hosted-page-view.tsx`

## Commit

Included in the logo-v3 surfaces task commit; the final commit ID is reported to the parent task after this file is committed.

## Verification

- `npm run typecheck` — passed.
- `mobile: npm run typecheck` — passed.
- `mobile: npx expo config --type public --json` — resolved the v3 icon/favicon, the SDK 57 splash plugin, `#080b10` contained splash configuration, and unchanged Android/iOS IDs.
- `mobile: npx expo export --platform all` — passed for Android, iOS and web.
- `mobile: npx expo prebuild --no-install --platform all` in an isolated copy — passed; generated both native projects with the obsidian splash background and contained image assets.
- Next development route check — `/opengraph-image` returned HTTP 200 `image/jpeg`, 1200×630, with bytes matching the prepared card; rendered metadata contained the v3 32/64px icons, 180px Apple icon and v3 Open Graph/Twitter images.

## Concerns

No code blocker. Expo documents that the final splash appearance should be checked in a preview or release build on device; this task validated generated native configuration/assets but did not perform that device-only visual check.
