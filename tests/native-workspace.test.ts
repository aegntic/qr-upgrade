import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openWorkspaceTarget,
  workspaceLinks,
  type WorkspaceTarget,
} from "../mobile/src/workspace-links";
import { openWorkspaceUrl } from "../mobile/src/workspace-opener.web";

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

test("workspace helper sends only exact allowlisted URLs", async () => {
  const opened: string[] = [];
  for (const target of Object.keys(workspaceLinks) as WorkspaceTarget[])
    await openWorkspaceTarget(target, (url) => {
      opened.push(url);
    });
  assert.deepEqual(opened, Object.values(workspaceLinks));
  await assert.rejects(
    openWorkspaceTarget("account", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
});

test("actual web opener creates an isolated tab without navigating the original window", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalLocation = { href: "https://preview.example/export" };
  const calls: Array<unknown[]> = [];
  let isolated = false;
  const tab = {
    set opener(value: unknown) {
      calls.push(["opener", value]);
      isolated = value === null;
    },
    location: {
      replace(url: string) {
        calls.push(["replace", url, isolated]);
      },
    },
  };
  const fakeWindow = {
    location: originalLocation,
    open(url: string, target: string) {
      calls.push(["open", url, target]);
      return tab;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  try {
    await openWorkspaceUrl(workspaceLinks.designs);
    assert.deepEqual(calls, [
      ["open", "about:blank", "_blank"],
      ["opener", null],
      ["replace", workspaceLinks.designs, true],
    ]);
    assert.equal(originalLocation.href, "https://preview.example/export");

    fakeWindow.open = (url: string, target: string) => {
      calls.push(["blocked", url, target]);
      return null as unknown as typeof tab;
    };
    await assert.rejects(openWorkspaceUrl(workspaceLinks.account), /blocked the new tab/);
    assert.equal(originalLocation.href, "https://preview.example/export");
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else delete (globalThis as { window?: unknown }).window;
  }
});
