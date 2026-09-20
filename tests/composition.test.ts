import test from "node:test";
import assert from "node:assert/strict";
import { compositionLayout, sourceCrop } from "../src/lib/browser-art";
import { defaultCaption, defaultImageAdjustments } from "../src/lib/editor-draft";

test("image positioning stays inside rectangular source bounds at every edge", () => {
  assert.deepEqual(sourceCrop(1200, 800, defaultImageAdjustments), { x: 200, y: 0, size: 800 });
  assert.deepEqual(sourceCrop(1200, 800, { ...defaultImageAdjustments, zoom: 2, x: 0, y: 100 }), { x: 0, y: 400, size: 400 });
  assert.deepEqual(sourceCrop(800, 1200, { ...defaultImageAdjustments, zoom: 3, x: 100, y: 0 }), { x: 800 - 800 / 3, y: 0, size: 800 / 3 });
});

test("caption reserves one narrow outer band while retaining a square QR", () => {
  assert.deepEqual(compositionLayout(defaultCaption), { hasCaption: false, band: 0, qrSize: 768, qrLeft: 0, qrTop: 0 });
  assert.deepEqual(compositionLayout({ ...defaultCaption, text: "Scan me", position: "top" }), { hasCaption: true, band: 72, qrSize: 696, qrLeft: 36, qrTop: 72 });
  assert.deepEqual(compositionLayout({ ...defaultCaption, text: "Scan me", position: "bottom" }), { hasCaption: true, band: 72, qrSize: 696, qrLeft: 36, qrTop: 0 });
});
