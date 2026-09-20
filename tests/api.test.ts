import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  createScanHandler,
  redisRateLimit,
  type AuditEvent,
} from "../src/lib/security/scan-api";
const secret = randomBytes(32).toString("hex");
const valid = {
  foreground: "#193c2f",
  background: "#ffffff",
  quietZone: 4,
  sizeMm: 40,
  distanceCm: 40,
  modules: 29,
};
const request = (
  body = JSON.stringify(valid),
  type = "application/json",
  auth = `Bearer ${secret}`,
) =>
  new Request("http://localhost/api/v1/scan", {
    method: "POST",
    headers: { "content-type": type, authorization: auth },
    body,
  });
const handler = (
  extra: Partial<Parameters<typeof createScanHandler>[0]> = {},
) =>
  createScanHandler({
    enabled: true,
    secret,
    limit: async () => ({ allowed: true, retryAfter: 60 }),
    ...extra,
  });
test("API is disabled by default and fails closed when protection is absent", async () => {
  assert.equal(
    (await createScanHandler({ enabled: false })(request())).status,
    404,
  );
  assert.equal(
    (await createScanHandler({ enabled: true, secret })(request())).status,
    503,
  );
  assert.equal((await handler({ secret: "short" })(request())).status, 503);
});
test("API rejects missing, malformed and incorrect bearer credentials before processing", async () => {
  let limited = 0;
  const post = handler({
    limit: async () => {
      limited++;
      return { allowed: true, retryAfter: 60 };
    },
  });
  for (const value of [
    "",
    "Basic abc",
    "Bearer wrong",
    "Bearer " + secret + "x",
  ]) {
    const res = await post(request("not json", "application/json", value));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  assert.equal(limited, 0);
});
test("API distinguishes screening from decoding and emits no sensitive audit values", async () => {
  const events: AuditEvent[] = [];
  const response = await handler({ audit: (e) => events.push(e) })(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.score, 100);
  assert.equal(body.decoderTested, false);
  assert.deepEqual(Object.keys(events[0]).sort(), [
    "durationMs",
    "event",
    "requestId",
    "status",
  ]);
  assert.equal(JSON.stringify(events).includes(secret), false);
  assert.equal(events[0].requestId, response.headers.get("x-request-id"));
});
test("centralized quota denies excess calls and fails closed on backend outage", async () => {
  const quota = await handler({
    limit: async () => ({ allowed: false, retryAfter: 12 }),
  })(request());
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("retry-after"), "12");
  assert.equal(
    (
      await handler({
        limit: async () => {
          throw new Error("private connection detail");
        },
      })(request())
    ).status,
    503,
  );
});
test("streamed body limit rejects oversized content without Content-Length", async () =>
  assert.equal((await handler()(request(" ".repeat(4097)))).status, 413));
test("body timeout bounds stalled request streams", async () => {
  const stream = new ReadableStream({ start() {} });
  const req = new Request("http://localhost/api/v1/scan", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.equal((await handler({ bodyTimeoutMs: 15 })(req)).status, 408);
});
test("API rejects malformed JSON, misleading media types, unknown fields and invalid numbers", async () => {
  for (const body of [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...valid, distanceCm: -1 }),
    JSON.stringify({ ...valid, url: "private content" }),
  ])
    assert.equal((await handler()(request(body))).status, 400);
  for (const type of ["text/plain", "text/application/jsonx"])
    assert.equal((await handler()(request("{}", type))).status, 415);
});
test("rate limiter requires an explicit HTTPS service endpoint and credential", () => {
  assert.equal(redisRateLimit(undefined, secret), undefined);
  assert.equal(redisRateLimit("http://example.com", secret), undefined);
  assert.equal(
    redisRateLimit("https://user:pass@example.com", secret),
    undefined,
  );
});
