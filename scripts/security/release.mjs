import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { root, sourceDigest, artifactHash } from "./source.mjs";
import { evaluateRelease } from "./policy.mjs";
const evidence = path.join(root, "compliance/evidence");
const read = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
};
const catalog = await read(path.join(root, "compliance/controls.json"));
if (!catalog) throw new Error("Control catalog unavailable. Release blocked.");
const report = await read(path.join(evidence, "latest.json")),
  attestations = await read(path.join(evidence, "manual.json"));
const digest = await sourceDigest();
const result = await evaluateRelease({
  catalog,
  report,
  attestations,
  digest,
  hashArtifact: (p) => artifactHash(evidence, p),
});
await mkdir(evidence, { recursive: true, mode: 0o700 });
const assessment = {
  schemaVersion: 1,
  evaluatedAt: new Date().toISOString(),
  sourceDigest: digest,
  status: result.allowed ? "ready_for_authorized_release" : "blocked",
  certification: "none",
  ...result,
};
await writeFile(
  path.join(evidence, "release-readiness.json"),
  JSON.stringify(assessment, null, 2) + "\n",
  { mode: 0o600 },
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const state = new Map((report?.checks ?? []).map((c) => [c.id, c.status]));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QR Upgrade · Enterprise readiness</title><style>body{font:16px/1.55 system-ui;background:#f5f5ef;color:#193c2f;max-width:1100px;margin:50px auto;padding:24px}h1{font-size:42px;letter-spacing:-1.6px}h2{margin-top:38px}article{background:white;padding:24px;border:1px solid #d5ddcc;border-radius:12px;margin:20px 0}strong.bad{color:#9c482c}td,th{text-align:left;padding:10px;border-bottom:1px solid #e0e5d9}table{width:100%;border-collapse:collapse;font-size:14px}.meta{font-size:12px;color:#657366;overflow-wrap:anywhere}li{margin-bottom:10px}</style><p>QR UPGRADE / PRIVATE CONTROL REGISTER</p><h1>Enterprise release ${result.allowed ? "ready for approval" : "blocked"}.</h1><p>${escape(result.blockers.length)} outstanding checks. This report covers a defined prototype, not company-wide compliance or certification.</p><p class="meta">Evaluated ${escape(assessment.evaluatedAt)}<br>Source SHA-256: ${escape(digest)}<br>Do not publish this internal evidence report.</p><article><h2>Automated checks</h2><table><tr><th>Control</th><th>Evidence</th><th>Last result</th></tr>${catalog.automated.map((c) => `<tr><td>${escape(c.id)}</td><td>${escape(c.title)}</td><td>${escape(state.get(c.id) || "missing")}</td></tr>`).join("")}</table></article><article><h2>Release blockers</h2><ul>${result.blockers.map((b) => `<li>${escape(b)}</li>`).join("") || "<li>Required evidence is present. An authorized release owner still approves deployment.</li>"}</ul></article><article><h2>Required organizational controls</h2><table><tr><th>Control</th><th>Requirement</th><th>Review window</th></tr>${catalog.manual.map((c) => `<tr><td>${escape(c.id)}</td><td>${escape(c.title)}<br><span class="meta">${escape(c.requiredEvidence)}</span></td><td>${c.maxAgeDays} days</td></tr>`).join("")}</table></article><p>No SOC 2 attestation, ISO certificate, legal compliance opinion, or Vanta integration is claimed. Evidence files must be reviewed by accountable people and protected by the organization's access controls.</p></html>`;
await writeFile(path.join(evidence, "readiness.html"), html, { mode: 0o600 });
console.log(
  `Enterprise release: ${assessment.status}. ${result.blockers.length} blockers.`,
);
for (const blocker of result.blockers) console.log("- " + blocker);
process.exitCode = result.allowed ? 0 : 1;
