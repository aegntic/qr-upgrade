import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { decodePixels } from "../shared/decode";
import { Content, createMatrix, payload, qrSvg } from "../shared/qr";
import { assessPrint, autoFix, validatePrintInput } from "../shared/score";
const base: Content = {
  type: "url",
  url: "https://qrupgrade.com",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};
const print = {
  foreground: "#214638",
  background: "#ffffff",
  quietZone: 4,
  sizeMm: 28,
  distanceCm: 40,
  modules: 29,
};
test("rejects active URLs and malformed input", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "not a url",
    "",
  ])
    assert.throws(() => payload({ ...base, url }));
  assert.throws(() => validatePrintInput({ ...print, modules: 22 }));
  assert.throws(() => validatePrintInput({ ...print, distanceCm: Infinity }));
  assert.throws(() => validatePrintInput({ ...print, foreground: "red" }));
});
test("escapes Wi-Fi separators and contact newlines", () => {
  assert.equal(
    payload({ ...base, type: "wifi", ssid: "Cafe;A:B", password: "p\\word" }),
    "WIFI:T:WPA;S:Cafe\\;A\\:B;P:p\\\\word;;",
  );
  assert.match(
    payload({ ...base, type: "vcard", name: "A\nTEL:evil;Person" }),
    /FN:A\\nTEL:evil\\;Person\r\nTEL:/,
  );
});
test("autofix repairs print hazards without reducing viewing distance", () => {
  const bad = {
    ...print,
    foreground: "#bbbbbb",
    background: "#cccccc",
    quietZone: 0,
    sizeMm: 10,
    distanceCm: 200,
    modules: 77,
  };
  const fixed = autoFix(bad);
  assert.equal(fixed.distanceCm, 200);
  assert.equal(assessPrint(fixed).score, 100);
  assert.ok(fixed.sizeMm >= 200);
  assert.equal(autoFix(fixed).sizeMm, fixed.sizeMm);
});
test("high contrast inverted codes still fail print screening", () =>
  assert.equal(
    assessPrint({ ...print, foreground: "#ffffff", background: "#000000" })
      .checks[0].passed,
    false,
  ));
for (const content of [
  base,
  {
    ...base,
    type: "wifi" as const,
    ssid: "Example café",
    password: "demo-only",
  },
  {
    ...base,
    type: "vcard" as const,
    name: "Sample Person",
    email: "sample@example.com",
    phone: "+1 555 0100",
  },
])
  for (const style of ["square", "soft", "dot"] as const)
    test(`${content.type} ${style} exports decode to the exact payload`, async () => {
      const text = payload(content),
        matrix = createMatrix(text),
        svg = qrSvg(matrix, { ...print, style });
      for (const size of [384, 768]) {
        const { data, info } = await sharp(Buffer.from(svg))
          .resize(size, size)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        assert.equal(
          decodePixels(new Uint8ClampedArray(data), info.width, info.height),
          text,
          `${style} at ${size}px`,
        );
      }
    });
