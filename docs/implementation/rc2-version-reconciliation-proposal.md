# RC2 version reconciliation proposal (draft, not applied)

Status: proposed for RC2. RC1 artifacts and commit `5f328cf` remain untouched.

## Finding 1: version mismatch between package.json and app.json

1. `mobile/package.json` declares `"version": "1.0.0"`.
2. `mobile/app.json` declares `"expo.version": "0.1.0"` and `"expo.android.versionCode": 3`.
3. The built RC1 AAB therefore carries user-visible version `0.1.0` (versionCode 3), while the
   Node package claims 1.0.0. Play listings, in-app "about" surfaces that read
   `expo-constants` `nativeApplicationVersion`, and EAS metadata will show 0.1.0.

Proposal for RC2: pick one public version and set both files to it. Recommend `1.0.0`
(userVisibleVersion) with `android.versionCode` continuing from the EAS auto-increment value
(check `eas build:list` for the latest versionCode before the RC2 build) and, if an iOS build
follows, `ios.buildNumber` kept in lockstep with `versionCode`.

## Finding 2: missing iOS build number

1. `expo.ios` defines `bundleIdentifier` and `supportsTablet` but no `buildNumber`.
2. Any iOS/TestFlight RC would rely on EAS defaults, which risks a mismatch with the Android
   versioning story once iOS work resumes.

Proposal for RC2: add `"buildNumber": "3"` (or the RC2 equivalent) under `expo.ios` so both
platforms report the same build identity, even though this RC is Android-only.

## Why not applied now

1. Changing `expo.version` after RC1 was built would make the committed evidence describe a
   binary that no longer matches source.
2. The version bump belongs with the next release cut, alongside its own EAS build evidence.

## Evidence paths

1. `/home/ae/Projects/QR-Upgrade-MobileRC/mobile/package.json` (version 1.0.0)
2. `/home/ae/Projects/QR-Upgrade-MobileRC/mobile/app.json` (expo.version 0.1.0, versionCode 3, no ios.buildNumber)
3. `/home/ae/Projects/QR-Upgrade-MobileRC/release-artifacts/eas-build-finished.json` (appVersion 0.1.0, appBuildVersion 3)
