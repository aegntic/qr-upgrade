import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { childExited, readHttpResponse } from "./http.mjs";
import { root } from "./source.mjs";
const port = Number(process.env.SECURITY_CHECK_PORT || 3029),
  origin = `http://127.0.0.1:${port}`,
  readinessBudgetMs = 30000,
  readinessAttemptMs = 5000,
  requestDeadlineMs = 15000;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", SCAN_API_ENABLED: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
try {
  let response;
  let readinessError;
  const readinessDeadline = Date.now() + readinessBudgetMs;
  while (Date.now() < readinessDeadline) {
    if (childExited(server))
      throw new Error("Isolated server failed to start: " + output);
    try {
      response = await readHttpResponse(
        origin,
        {},
        Math.max(
          1,
          Math.min(readinessAttemptMs, readinessDeadline - Date.now()),
        ),
        "Readiness request GET /",
      );
      break;
    } catch (error) {
      readinessError = error;
      if (childExited(server))
        throw new Error("Isolated server failed to start: " + output, {
          cause: error,
        });
      const remaining = readinessDeadline - Date.now();
      if (remaining > 0) await delay(Math.min(200, remaining));
    }
  }
  assert.ok(
    response,
    `Isolated production server did not become ready within ${readinessBudgetMs}ms.${readinessError instanceof Error ? ` Last error: ${readinessError.message}` : ""}`,
  );
  assert.ok(
    response.ok,
    "Isolated production server readiness status was not OK.",
  );
  const csp = response.headers.get("content-security-policy") || "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  const scripts =
    csp.split(";").find((s) => s.trim().startsWith("script-src")) || "";
  assert.ok(
    !scripts.includes("unsafe-inline") && !scripts.includes("unsafe-eval"),
  );
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(
    response.headers.get("strict-transport-security") || "",
    /max-age=31536000/,
  );
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const html = response.body;
  for (const tag of html.matchAll(/<script\b[^>]*>/g))
    assert.ok(
      tag[0].includes(`nonce="${nonce}"`),
      "Every emitted script must carry the request nonce.",
    );
  for (const route of [
    "/generator",
    "/designs",
    "/cloud-designs",
    "/account",
    "/scan-lab",
    "/templates",
    "/docs",
    "/ai",
    "/pricing",
    "/blog",
    "/dynamic",
    "/brand-kits",
  ]) {
    const page = await readHttpResponse(
      origin + route,
      {},
      requestDeadlineMs,
      `Security request GET ${route}`,
    );
    assert.equal(page.status, 200, route + " status");
    const pagePolicy = page.headers.get("content-security-policy") || "";
    const pageNonce = pagePolicy.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(pageNonce, route + " needs a CSP nonce");
    const content = page.body;
    for (const tag of content.matchAll(/<script\b[^>]*>/g))
      assert.ok(
        tag[0].includes(`nonce="${pageNonce}"`),
        route + " emitted an unprotected script",
      );
  }
  const again = await readHttpResponse(
    origin,
    {},
    requestDeadlineMs,
    "Nonce freshness request GET /",
  );
  assert.notEqual(
    again.headers.get("content-security-policy"),
    csp,
    "Each request needs a fresh nonce.",
  );
  const api = await readHttpResponse(
    origin + "/api/v1/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
    requestDeadlineMs,
    "Disabled API request POST /api/v1/scan",
  );
  assert.equal(api.status, 404);
  assert.equal(api.headers.get("cache-control"), "no-store");
  console.log(
    "Live production checks passed: per-response script nonce, no-store, browser restrictions, HSTS, disabled API. TLS termination and WAF remain deployment checks.",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (childExited(server)) return resolve();
    server.once("exit", resolve);
    setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 5000).unref();
  });
}
