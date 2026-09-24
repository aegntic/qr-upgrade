# RC1 follow-up: device detection and universal APK — 2026-09-25

Scope: same RC1 (commit `5f328cf`, AAB sha256 ebac44a378e58bcafc88e27d652078bacedce59ba1bb9a6354e9c5aefa9fc13). No store submission.

## 1. Physical device detection: NOT AVAILABLE

1. `adb` is not installed on this host (checked PATH, common SDK locations).
2. USB bus scan (sysfs, no lsusb installed) shows only: DockCase SSD enclosure, HyperFIDO key,
   wired gaming mouse, Acer webcam. No Android device in ADB interface mode.
3. No `adb` server is running (port 5037 closed; user systemd unit inactive).
4. Conclusion: no physical Android device is connected or usable.

MISSING EVIDENCE: physical-device smoke test

## 2. Universal APK derived from the same AAB

1. Downloaded the EAS-managed Android keystore through `eas-cli credentials -p android`
   (Download credentials flow). Files: `mobile/credentials.json` and
   `mobile/credentials/android/keystore.jks` (both gitignored; keystore sha256
   bcb78a463a43019e10f87f16ebf3d88d9fc384c86ed40ea7a270e3eb9579071a).
   Keystore alias fingerprint matches the EAS build signer certificate:
   SHA256 6E:C2:00:73:96:19:14:B2:C6:BB:03:17:ED:71:EC:27:C5:96:F6:5B:4A:14:C2:95:B4:77:30:24:A1:63:E4:81.
2. bundletool 1.18.1 (java 21) `build-apks --mode=universal`, signed with that keystore:
   intermediate `.apks` deleted after extraction.
3. Extracted universal APK: `release-artifacts/qr-upgrade-rc1-universal.apk`
   (139,674,808 bytes).
4. SHA-256: `8940eb0455a23ef8de3828496cb287b9d8e1c2bcb3cfecc05989e7f110ebcc9e`.
5. Signature check (scripted, no apksigner on host): APK Signature Scheme v2 block present
   AND v3 block present. Installable signature is the same identity EAS used for the AAB,
   so it installs on the same device a Play-installed build would update.
6. Note: this is a universal APK (all ABIs and densities). Its byte size is larger than the
   Play-delivered splits; that is expected.

## 3. When a device becomes available

1. `adb install release-artifacts/qr-upgrade-rc1-universal.apk`
   (uninstall `com.qrupgrade.app` first if a differently-signed build is present).
2. Execute the 10-step checklist in `docs/implementation/android-rc1-2026-09-25.md`
   and record model, Android version, and pass/fail per step in this directory.

## 4. RC2 version reconciliation

See `docs/implementation/rc2-version-reconciliation-proposal.md`:
- `mobile/package.json` says 1.0.0 but the binary reports 0.1.0 (`expo.version`).
- `expo.ios.buildNumber` is missing.
Both are proposed RC2 changes; RC1 is intentionally unchanged.

## Evidence paths

1. `/home/ae/Projects/QR-Upgrade-MobileRC/release-artifacts/qr-upgrade-rc1-universal.apk`
2. `/home/ae/Projects/QR-Upgrade-MobileRC/release-artifacts/qr-upgrade-rc1-build3.aab`
3. `/home/ae/Projects/QR-Upgrade-MobileRC/docs/implementation/rc2-version-reconciliation-proposal.md`
4. `/home/ae/Projects/QR-Upgrade-MobileRC/docs/implementation/android-rc1-2026-09-25.md`
