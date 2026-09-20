import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { root, sourceDigest } from "./source.mjs";
const evidence = path.join(root, "compliance/evidence");
const run = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
await mkdir(path.join(evidence, run), { recursive: true, mode: 0o700 });
const digest = await sourceDigest();
const scannerVersion = (binary, args) => {
  const r = spawnSync(binary, args, { encoding: "utf8", timeout: 30000 });
  return r.status === 0 ? r.stdout.trim() : "unavailable";
};
const versions = {
  node: process.version,
  gitleaks: scannerVersion(process.env.GITLEAKS_BIN || "gitleaks", ["version"]),
  semgrep: scannerVersion(process.env.SEMGREP_BIN || "semgrep", ["--version"]),
};
const report = {
  schemaVersion: 1,
  sourceDigest: digest,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: "running",
  checks: [],
  toolVersions: versions,
  limitations: [
    "Code and configuration evidence only. This is not a SOC 2 report, ISO certification, penetration test, native runtime test, or proof of company-wide control operation.",
  ],
};
const save = async () => {
  const json = JSON.stringify(report, null, 2) + "\n";
  await writeFile(path.join(evidence, run, "report.json"), json, {
    mode: 0o600,
  });
  await writeFile(path.join(evidence, "latest.json"), json, { mode: 0o600 });
};
await save();
const tasks = [
  [
    "T01",
    "gitleaks",
    [
      "dir",
      "--redact=100",
      "--no-banner",
      "--config",
      ".gitleaks.toml",
      "--report-format",
      "json",
      "--report-path",
      path.join(evidence, run, "secrets.json"),
      ".",
    ],
    ".",
    "secrets.json",
  ],
  [
    "T02",
    "semgrep",
    [
      "scan",
      "--jobs",
      "1",
      "--config",
      "p/typescript",
      "--config",
      "p/react",
      "--config",
      "p/nodejs",
      "--metrics",
      "off",
      "--disable-version-check",
      "--no-git-ignore",
      "--error",
      "--strict",
      "--json",
      "--output",
      path.join(evidence, run, "sast.json"),
      "src",
      "shared",
      "mobile/app",
      "mobile/src",
      "mobile/plugins",
      "scripts",
    ],
    ".",
    "sast.json",
  ],
  ["T03", "npm", ["audit", "--json", "--ignore-scripts"], "."],
  ["T04", "npm", ["audit", "--json", "--ignore-scripts"], "mobile"],
  ["T05", "npm", ["test"], "."],
  ["T06", "npm", ["run", "typecheck"], "."],
  ["T07", "npm", ["run", "typecheck"], "mobile"],
  ["T08", "npm", ["run", "build"], "."],
  ["T09", "node", ["scripts/security/native-check.mjs"], "."],
  ["T10", "npm", ["run", "export"], "mobile"],
  ["T11", "node", ["scripts/security/http-check.mjs"], "."],
  ["T12", "npm", ["sbom", "--sbom-format=cyclonedx"], "."],
  ["T13", "npm", ["sbom", "--sbom-format=cyclonedx"], "mobile"],
];
for (const [id, tool, args, cwd, extra] of tasks) {
  process.stdout.write(`${id}: ${tool} check started\n`);
  const binary =
    tool === "gitleaks"
      ? process.env.GITLEAKS_BIN || tool
      : tool === "semgrep"
        ? process.env.SEMGREP_BIN || tool
        : tool;
  const started = new Date().toISOString();
  let output = "",
    stdout = "",
    exitCode = 1;
  const childEnv = {
    ...process.env,
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    EXPO_NO_TELEMETRY: "1",
    SEMGREP_SEND_METRICS: "off",
  };
  if (id === "T03" || id === "T04") {
    // npm run exports the user's .npmrc allow-scripts value as a CLI-scoped
    // variable, which npm 11.19 rejects on audit. Read the original .npmrc
    // policy instead; audit additionally receives --ignore-scripts.
    delete childEnv.npm_config_allow_scripts;
    delete childEnv.NPM_CONFIG_ALLOW_SCRIPTS;
  }
  await new Promise((resolve) => {
    const child = spawn(binary, args, {
      cwd: path.join(root, cwd),
      env: childEnv,
      shell: false,
    });
    const timeout = setTimeout(
      () => {
        output += "\nTIMEOUT\n";
        child.kill("SIGKILL");
      },
      15 * 60 * 1000,
    );
    child.stdout.on("data", (b) => {
      output += b;
      stdout += b;
    });
    child.stderr.on("data", (b) => (output += b));
    child.on("error", (e) => {
      output += "Scanner/check could not start: " + e.code;
      clearTimeout(timeout);
      resolve();
    });
    child.on("close", (code) => {
      exitCode = code ?? 1;
      clearTimeout(timeout);
      resolve();
    });
  });
  if (id === "T01" && !versions.gitleaks.includes("8.30.1")) exitCode = 1;
  if (id === "T02" && versions.semgrep !== "1.177.0") exitCode = 1;
  const artifacts = [];
  if (["T03", "T04", "T12", "T13"].includes(id)) {
    try {
      const data = JSON.parse(stdout);
      if (
        ["T03", "T04"].includes(id) &&
        data.metadata?.vulnerabilities?.total !== 0
      )
        exitCode = 1;
      if (
        ["T12", "T13"].includes(id) &&
        (data.bomFormat !== "CycloneDX" || !data.components?.length)
      )
        exitCode = 1;
      const resultPath = `${run}/${id}.json`;
      await writeFile(path.join(evidence, resultPath), stdout, { mode: 0o600 });
      artifacts.push({
        path: resultPath,
        sha256: createHash("sha256").update(stdout).digest("hex"),
      });
    } catch {
      exitCode = 1;
    }
  }
  const logPath = `${run}/${id}.log`;
  await writeFile(path.join(evidence, logPath), output || "(No output)\n", {
    mode: 0o600,
  });
  artifacts.push({
    path: logPath,
    sha256: createHash("sha256")
      .update(output || "(No output)\n")
      .digest("hex"),
  });
  if (extra) {
    try {
      const data = await readFile(path.join(evidence, run, extra));
      artifacts.push({
        path: `${run}/${extra}`,
        sha256: createHash("sha256").update(data).digest("hex"),
      });
    } catch {
      exitCode = 1;
    }
  }
  if (id === "T01" || id === "T02") {
    // Machine-readable output must confirm scan coverage; an empty/incomplete scan is not a pass.
    try {
      const data = JSON.parse(
        await readFile(path.join(evidence, run, extra), "utf8"),
      );
      if (id === "T01" && (!Array.isArray(data) || data.length)) exitCode = 1;
      if (
        id === "T02" &&
        (!data.paths?.scanned?.length ||
          data.errors?.length ||
          data.results?.length)
      )
        exitCode = 1;
    } catch {
      exitCode = 1;
    }
  }
  report.checks.push({
    id,
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
    startedAt: started,
    finishedAt: new Date().toISOString(),
    command: [tool, ...args.map((a) => a.replace(evidence, "<evidence>"))],
    workingDirectory: cwd,
    artifacts,
  });
  await save();
  console.log(
    `${id}: ${exitCode === 0 ? "PASS" : "FAIL"} (${path.relative(root, path.join(evidence, logPath))})`,
  );
}
report.finishedAt = new Date().toISOString();
report.status =
  report.checks.every((c) => c.status === "passed") &&
  digest === (await sourceDigest())
    ? "passed"
    : "failed";
await save();
console.log(
  `Technical evidence: ${report.status}. ${path.relative(root, path.join(evidence, "latest.json"))}`,
);
process.exitCode = report.status === "passed" ? 0 : 1;
