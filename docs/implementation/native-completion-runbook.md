# Native completion verification runbook

## Implemented core boundary (21 September 2026)

The library model, native storage/image adapters and injected persistence engine exist. The Create/library UI, save identities, dirty/discard handling, session cleanup lifecycle, destination forms, workspace links and web PDF are separate tasks. Nothing automatically saves the current draft. This core is not yet a user-accessible library.

Native storage uses `Paths.document/qrupgrade-library-v1/<UUID>/<generation>.qru`. `QRUL1|1|<UUID>|<generation>\n` is authenticated as AES-GCM AAD; the sealed bytes contain a fresh 12-byte nonce and 16-byte tag. All title/destination/settings/image bytes are encrypted together with a generated 256-bit installation key. SecureStore stores only the 64-character hex key, using the fixed `qrupgrade.local-library.key.v1` service and item, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and `requireAuthentication: false`. The accessibility choice is an iOS keychain setting; do not claim a separate Android locked-device authentication gate.

This is private encrypted storage, not an app lock. An unlocked app can open saves. JS memory cannot be reliably zeroized. No key, raw payload, image bytes or verification evidence should enter logs, analytics or React state. A Wi-Fi QR output itself reveals its password to a scanner.

Android introspection must keep `allowBackup=false` and `fullBackupContent=false`. The SecureStore plugin is configured with `configureAndroidBackup: false` and `faceIDPermission: false` to preserve existing security settings. iOS file sharing and opening documents in place stay disabled/absent. Encrypted iOS document files may enter OS backups; the device-only key may not survive migration, making restored files unreadable. No verified iOS backup-exclusion API is applied. The existing encryption/export declaration must be reviewed against the final build before distribution; this implementation does not establish a legal classification.

## UI integration contract

1. Call `purgeStaleLibraryImageCache()` once on cold startup, before creating any saved-design working session or starting renders that consume one. It deletes only `qrupgrade-working` and `qrupgrade-normalizing` under private cache. Never call this purge during a live session.
2. At explicit Save click, copy the current editable draft, including nested content/appearance. Normalize that same captured draft with `captureLibraryAssets()`, then pass the captured draft and returned assets to `localLibrary.save()`. A new save has no ID; changes require the saved ID and `expectedGeneration`. Busy/conflicting controls belong to the UI. Edits made during normalization/save must not be marked clean unless they still match the captured values.
3. `snapshotDraft()` validates a persistence snapshot and strips generated/verification fields and all inactive destination fields. It throws for incomplete payloads; dirty tracking must also account for invalid in-progress edits rather than treating that exception as clean. Images become fixed role references. Save never requires an earlier scan result.
4. List rows contain title, type, time and identity/status only. Display `issues`, `damaged`, `unsupported`, and `deleting` states. Do not log full returned design records. A damaged highest generation is not silently replaced by an older one. Its optional recovery metadata identifies only the immediately previous authenticated save.
5. Normal reopen: `open(id)`, then `materializeLibraryDesign(record)`. Replace the draft only after all image files and native decoding succeed. Always clear old artwork/verification and increment the rendering epoch even for equal content. Failure leaves the active draft alone. Warn before discarding edits.
6. Explicit recovery: after showing the previous saved time, call `open(id, { recoverPrevious: true })`. Open that result as an **unsaved copy**, without assigning its old generation as the current save identity; the damaged newest generation remains visible until deleted/reset. Saving the recovered draft as new uses the ordinary creation operation. Tombstones cannot be recovered as older designs.
7. Own the returned `sessionId`. Release the old session only once its asynchronous render consumers have settled after replacement/reset/unmount. Do not release the open draft's session merely because its library row was deleted; it remains a usable unsaved in-memory draft. Handle async generation invalidation in the UI lifecycle.
8. Rename uses the current generation. Confirm delete before `delete(id)`; only report complete removal when it resolves. A rejected cleanup may have already hidden the row behind a tombstone; retry list/delete resumes cleanup. Missing/malformed key and temporarily unavailable SecureStore are separate error codes. Only the explicit destructive `reset()` removes inaccessible ciphertext; reset deletes the exact owned root entry using the File or Directory returned by parent enumeration, then verifies absence before deleting its key. A regular file occupying the owned root is recoverable through the same action. Parent access or deletion failure retains the key.
9. Web uses the typed unsupported adapter and message “Private device saves are available in the Android and iOS apps.” Do not add browser persistence fallback.

Images must be live `file://` selections in this app's private cache, such as the existing Expo picker copies. Remote, data, content, arbitrary document paths and saved serialized paths are rejected; unsupported picker URIs require choosing the image again. Source bytes must be known, positive and at most 8 MiB before decoding, with at most 40 megapixels. Artwork becomes center-cropped 512×512 PNG, portrait 256×256 PNG, and scene an aspect-preserving JPEG of at most 1,024 pixels on its longest side at quality 0.82. Original full-resolution photos are not archived.

Normalization and reopen use native image decoding. Pure record validation checks MIME signatures, dimensions, bounded PNG/JPEG framing and canonical base64 without running a potentially unbounded JavaScript inflater. PNG normalization expects noninterlaced 8-bit RGB/RGBA output. Temporary normalization files are removed in `finally`. Expo's manipulator first creates its output in its own cache before the adapter moves it under its owned directory; a process kill in that narrow gap can leave an Expo-managed cache file. The owned purge intentionally does not sweep the shared ImageManipulator cache or picker originals. Cache deletion is best effort, not secure erasure. Actual image decoder memory behavior and orientation on devices remain runtime checks.

## Bounds and recovery

- Up to 20 design directories count toward the save limit, conservatively including damaged/pending-deletion entries; clean those explicitly before adding more.
- At most 100 MiB of owned files, including staging and retained generations; metadata excluding asset data ≤64 KiB, aggregate decoded image bytes ≤3 MiB, framed ciphertext ≤5 MiB.
- At least 15 MiB free headroom plus the next write size is required. Free-space checks are advisory; write errors remain handled.
- UUID v4 IDs, positive safe-integer generations and fixed owned filenames only; no incoming saved URIs. Inventory is capped at 512 entries, and unknown entries are preserved. Inaccessible parent-directory enumeration fails rather than being treated as an empty library.
- Strings ≤1,200 characters and encoded shared payload ≤1,200 UTF-8 bytes; title ≤80, brand ≤120; finite bounded settings; print width 10–2,000 mm. Existing `autoFix()` actually caps at 500 mm and current shared print assessment rejects values above 500 mm: do not expose persisted widths above that UI limit without separately handling the assessment boundary.
- Every mutation/read uses one instance queue. Writes create a unique staging file, authenticate it, await a non-overwriting move to the next immutable filename, and authenticate the final file. Ambiguous move/read errors trigger rescan/authentication. Persistent read uncertainty retains both generations and reports uncertainty.
- A previous generation survives the successful new save. A later successful cold list/open or current-version validation before the next mutation allows older-generation cleanup. Failed pruning is remembered against that authenticated generation; refreshing the same library instance retries it and keeps the warning visible until cleanup succeeds. Successful retry does not make a subsequent new save's backup eligible for immediate list cleanup. Corrupt highest records preserve the immediately previous candidate for explicit recovery; unsupported versions stay untouched.
- Deletion authenticates a higher-generation tombstone before removing older files. The tombstone remains until older files are confirmed absent. Do not claim fsync/power-loss durability or protection against an actor maliciously rolling back app storage.

## Reproducible local checks

Use exact Node 22.23.2 (the checked-in `.nvmrc`). From repository root:

```sh
PATH=/home/ae/.local/share/mise/installs/node/22.23.2/bin:$PATH node --import tsx --test --test-reporter=spec tests/native-library.test.ts
PATH=/home/ae/.local/share/mise/installs/node/22.23.2/bin:$PATH npm --prefix mobile run typecheck
```

For the core-only preflight, create a temporary `mobile/src/.local-library-preflight.ts` exporting `localLibrary` from `./local-library` and all helpers from `./local-library-images`. From `mobile`, bundle it independently of the not-yet-wired screens, then remove the temporary entry:

```sh
npx expo export:embed --entry-file src/.local-library-preflight.ts --platform android --dev false --minify false --max-workers 2 --bundle-output /tmp/qrupgrade-native-library-20260921.android.js
npx expo export:embed --entry-file src/.local-library-preflight.ts --platform ios --dev false --minify false --max-workers 2 --bundle-output /tmp/qrupgrade-native-library-20260921.ios.js
npx expo config --type introspect --json > /tmp/qrupgrade-native-library-20260921-config.json
```

These exports validate native JavaScript dependency resolution, not Hermes execution, native AES/Keychain/Keystore execution, installed-app storage, or device crash durability. The injected Node crypto adapter is used only in tests. After UI integration, root must run the whole mobile Android/iOS/web export graph and fresh platform builds.

## Required actual runtime evidence after UI integration

Record platform/build identity and pass/fail rather than inferring success from source:

- Android and iOS: offline explicit save of all ten types; kill/restart/reopen; retained image bytes after deleting original picker copies; all three image roles, portrait crop, scene aspect and orientation.
- Same-content reopen clears verification; exact rendered-output decode succeeds again. Missing/invalid image reopen leaves old draft and verification unchanged.
- Edit while saving, switch route while saving, discard confirmation, stale-generation conflicts, rename, full-library and low-storage failures leave the working draft usable.
- Locked-device/restart SecureStore outcomes; missing key and failed-authentication presentation; explicit reset cleans files before key. No silent key creation over ciphertext.
- Interrupted save/move/readback and delete/restart behavior with real app storage. Inspect private durable directory for ciphertext only; check pending cleanup indicators.
- Owned session cleanup after asynchronous render work settles, navigation/unmount/reset, and cold-start purge; picker originals and durable saves remain untouched.
- Physical phones, memory pressure, power interruption, backup/restore and distribution behavior remain unverified until exercised. Simulator tests cannot establish all physical-device guarantees.

Workspace browser roundtrip and PNG/PDF export/share runtime checks are required after their separate implementation tasks. This core task does not implement those flows.
