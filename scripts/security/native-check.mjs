import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { root } from "./source.mjs";
const result = spawnSync(
  "npx",
  [
    "--no-install",
    "expo",
    "prebuild",
    "--clean",
    "--no-install",
    "--platform",
    "all",
  ],
  {
    cwd: path.join(root, "mobile"),
    env: { ...process.env, CI: "1" },
    encoding: "utf8",
    timeout: 180000,
  },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status ?? 1);
const android = await readFile(
  path.join(root, "mobile/android/app/src/main/AndroidManifest.xml"),
  "utf8",
);
const ios = await readFile(
  path.join(root, "mobile/ios/QRUpgrade/Info.plist"),
  "utf8",
);
const gradle = await readFile(
  path.join(root, "mobile/android/app/build.gradle"),
  "utf8",
);
assert.match(android, /android:allowBackup="false"/);
assert.match(android, /android:usesCleartextTraffic="false"/);
assert.match(
  android,
  /android:name="android.permission.RECORD_AUDIO"[^>]*tools:node="remove"/,
);
assert.match(
  android,
  /android:name="android.permission.SYSTEM_ALERT_WINDOW"[^>]*tools:node="remove"/,
);
assert.match(android, /android:name="android.permission.CAMERA"\s*\//);
assert.match(ios, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\s*\/>/);
assert.doesNotMatch(ios, /<key>NSMicrophoneUsageDescription<\/key>/);
assert.doesNotMatch(
  gradle,
  /release\s*\{[^}]*signingConfig signingConfigs\.debug/,
);
console.log(
  "Native configuration assertions passed. Device runtime and final signed-binary checks remain manual gates.",
);
