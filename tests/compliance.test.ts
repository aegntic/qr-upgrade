import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRelease } from "../scripts/security/policy.mjs";
const now = Date.parse("2026-09-18T00:00:00Z"),
  digest = "a".repeat(64),
  hash = "b".repeat(64);
const catalog = {
  automated: [{ id: "T01", title: "Test" }],
  manual: [{ id: "G01", title: "Review", maxAgeDays: 30, bindToSource: true }],
};
function fixture() {
  return {
    catalog,
    digest,
    now,
    hashArtifact: async () => hash,
    report: {
      schemaVersion: 1,
      sourceDigest: digest,
      status: "passed",
      finishedAt: new Date(now - 1000).toISOString(),
      checks: [
        {
          id: "T01",
          status: "passed",
          artifacts: [{ path: "result.log", sha256: hash }],
        },
      ],
    },
    attestations: {
      controls: [
        {
          id: "G01",
          status: "approved",
          owner: "Example owner",
          approvedBy: "Example reviewer",
          reviewedAt: new Date(now - 86400000).toISOString(),
          expiresAt: new Date(now + 86400000).toISOString(),
          sourceDigest: digest,
          artifact: "review.pdf",
          sha256: hash,
        },
      ],
    },
  };
}
test("release gate accepts complete fresh evidence matching the source", async () =>
  assert.equal((await evaluateRelease(fixture())).allowed, true));
test("release gate blocks missing approvals and missing scanner artifacts", async () => {
  const f = fixture();
  f.attestations.controls = [];
  f.report.checks[0].artifacts = [];
  const result = await evaluateRelease(f);
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.length >= 2);
});
test("release gate rejects stale, altered and source-mismatched evidence", async () => {
  const f = fixture();
  f.report.finishedAt = new Date(now - 2 * 86400000).toISOString();
  f.report.sourceDigest = "changed";
  f.hashArtifact = async () => "changed";
  assert.ok((await evaluateRelease(f)).blockers.length >= 3);
});
test("release gate rejects self-approval, duplicate checks and expired approvals", async () => {
  const f = fixture();
  f.attestations.controls[0].approvedBy = f.attestations.controls[0].owner;
  f.attestations.controls[0].expiresAt = new Date(now - 1).toISOString();
  f.report.checks.push(f.report.checks[0]);
  assert.ok((await evaluateRelease(f)).blockers.length >= 3);
});
