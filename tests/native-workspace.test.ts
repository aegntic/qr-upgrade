import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openWorkspaceTarget,
  workspaceLinks,
  type WorkspaceTarget,
} from "../mobile/src/workspace-links";

test("workspace handoff exposes only the frozen HTTPS allowlist", () => {
  assert.ok(Object.isFrozen(workspaceLinks));
  assert.deepEqual(workspaceLinks, {
    account: "https://qrupgrade.com/account",
    designs: "https://qrupgrade.com/cloud-designs",
    links: "https://qrupgrade.com/links",
    content: "https://qrupgrade.com/content",
  });
  for (const url of Object.values(workspaceLinks)) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.host, "qrupgrade.com");
    assert.equal(parsed.search, "");
    assert.equal(parsed.hash, "");
  }
});

test("successful and failed browser opens cannot mutate draft or session state", async () => {
  const state = Object.freeze({ draft: "local", session: "native-only" });
  const before = JSON.stringify(state);
  const opened: string[] = [];
  for (const target of Object.keys(workspaceLinks) as WorkspaceTarget[])
    await openWorkspaceTarget(target, (url) => {
      opened.push(url);
    });
  assert.deepEqual(opened, Object.values(workspaceLinks));
  assert.equal(JSON.stringify(state), before);
  await assert.rejects(
    openWorkspaceTarget("account", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  assert.equal(JSON.stringify(state), before);
});
