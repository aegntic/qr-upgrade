import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createMatrix, qrSvg } from "../shared/qr";
import { decodePixels } from "../shared/decode";
import { addQrPortrait } from "../shared/qr-portrait";
import { templates } from "../src/lib/generator-options";

test("every custom template decodes URL, Wi-Fi and contact payloads at small display size", async () => {
  for (const text of [
    "https://example.com/?utm_source=print&utm_medium=qr&utm_campaign=baseline",
    "WIFI:T:WPA;S:Demo;P:Synthetic-only;;",
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sample Person\r\nEND:VCARD",
  ]) {
    for (const template of templates) {
      const data = await sharp(Buffer.from(qrSvg(createMatrix(text), template)))
        .resize(256, 256)
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.equal(
        decodePixels(new Uint8ClampedArray(data), 256, 256),
        text,
        template.name,
      );
    }
  }
});
test("plain centre photo keeps the real custom QR decodable", async () => {
  const text = "https://example.com/profile/sample";
  const matrix = createMatrix(text);
  const qr = new Uint8ClampedArray(
    await sharp(Buffer.from(qrSvg(matrix, templates[0])))
      .resize(768, 768)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  const photo = new Uint8ClampedArray(
    await sharp("public/brand-studies/sample-portrait.png")
      .resize(256, 256)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  const composed = addQrPortrait(qr, 768, photo, 256, matrix, 20, "plain");
  assert.equal(decodePixels(composed, 768, 768), text);
  assert.notDeepEqual(composed, qr);
});
