import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { artworkDesigns, artDestination } from "../src/lib/artwork-designs";
import { integrateQrArtwork } from "../shared/qr-art";
import { createMatrix } from "../shared/qr";
import { decodePixels } from "../shared/decode";
for (const design of artworkDesigns) {
  test(`${design.name} shipped QR image decodes at display and export sizes`, async () => {
    for (const width of [184, 256, 512, 768]) {
      const data = await sharp(`public/artwork/${design.id}.webp`)
        .resize(width, width)
        .ensureAlpha()
        .raw()
        .toBuffer();
      assert.equal(
        decodePixels(new Uint8ClampedArray(data), width, width),
        artDestination,
      );
    }
  });
}
test("artwork can carry a new destination, Wi-Fi data and contact details", async () => {
  const width = 512;
  const source = new Uint8ClampedArray(
    await sharp("public/artwork/dragon-source.png")
      .resize(width, width)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  for (const text of [
    "https://example.com/your-campaign",
    "WIFI:T:WPA;S:Demo network;P:Synthetic-only;;",
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sample Person\r\nEND:VCARD",
  ]) {
    const output = integrateQrArtwork(source, width, createMatrix(text), 1);
    assert.equal(decodePixels(output, width, width), text);
    assert.notDeepEqual(output, source);
  }
});
test("artwork processing rejects excessive dimensions and invalid strength", () => {
  const matrix = createMatrix(artDestination);
  assert.throws(() =>
    integrateQrArtwork(new Uint8ClampedArray(4), 8000, matrix, 0.4),
  );
  assert.throws(() =>
    integrateQrArtwork(new Uint8ClampedArray(64 * 64 * 4), 64, matrix, NaN),
  );
});
