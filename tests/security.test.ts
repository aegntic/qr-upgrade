import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentSecurityPolicy,
  securityHeaders,
} from "../src/lib/security/headers";
import { payload, type Content } from "../shared/qr";
const content: Content = {
  type: "url",
  url: "https://qrupgrade.com",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};
test("production CSP has a nonce and denies inline scripts, eval and framing", () => {
  const policy = contentSecurityPolicy("a".repeat(24), true);
  const scripts = policy.split("; ").find((p) => p.startsWith("script-src"))!;
  assert.match(scripts, /'nonce-/);
  assert.equal(scripts.includes("unsafe-inline"), false);
  assert.equal(scripts.includes("unsafe-eval"), false);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /base-uri 'none'/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.throws(() => contentSecurityPolicy("x'; script-src *", true));
});
test("production headers restrict browser capabilities and hide referrers", () => {
  const h = Object.fromEntries(
    securityHeaders(true).map((h) => [h.key, h.value]),
  );
  assert.equal(h["Referrer-Policy"], "no-referrer");
  assert.match(h["Strict-Transport-Security"], /max-age=31536000/);
  assert.match(h["Permissions-Policy"], /camera=\(\)/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
});
test("QR payload rejects embedded URL credentials, control characters and oversized fields", () => {
  assert.throws(() =>
    payload({ ...content, url: "https://user:password@example.com" }),
  );
  assert.throws(() =>
    payload({ ...content, url: "https://example.com/\nprivate" }),
  );
  assert.throws(() => payload({ ...content, url: "x".repeat(1201) }));
});
test("bare carriage returns cannot inject contact fields", () => {
  const encoded = payload({
    ...content,
    type: "vcard",
    name: "Alice\rTEL:unwanted",
  });
  assert.match(encoded, /FN:Alice\\nTEL:unwanted\r\nTEL:/);
  assert.equal(encoded.includes("\rTEL:unwanted"), false);
});
