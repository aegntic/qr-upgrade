import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createMatrix } from "../shared/qr";
import { integrateQrArtwork } from "../shared/qr-art";
import { addQrPortrait } from "../shared/qr-portrait";
import { decodePixels } from "../shared/decode";

const photo = async () =>
  new Uint8ClampedArray(
    await sharp("public/brand-studies/sample-portrait.png")
      .resize(256, 256)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );

test("exported portrait study decodes its exact destination at four sizes", async () => {
  for (const width of [184, 256, 512, 768]) {
    const rgba = await sharp("public/brand-studies/x-portrait.png")
      .resize(width, width)
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.equal(
      decodePixels(new Uint8ClampedArray(rgba), width, width),
      "https://x.com/",
    );
  }
});

test("portrait survives new URL and contact payloads in repaired artwork", async () => {
  const width = 512;
  const source = new Uint8ClampedArray(
    await sharp("public/brand-studies/x-source.png")
      .resize(width, width)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  for (const text of [
    "https://example.com/profile/sample",
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sample Person\r\nEND:VCARD",
  ]) {
    const matrix = createMatrix(text);
    const result = addQrPortrait(
      integrateQrArtwork(source, width, matrix, 1),
      width,
      await photo(),
      256,
      matrix,
      20,
    );
    assert.equal(decodePixels(result, width, width), text);
  }
});

test("portrait preserves every function pixel, quiet zone, and pixels outside its disc", async () => {
  const width = 512;
  const matrix = createMatrix("https://example.com/" + "profile".repeat(6));
  const source = integrateQrArtwork(
    new Uint8ClampedArray(width * width * 4).fill(255),
    width,
    matrix,
    1,
  );
  const before = new Uint8ClampedArray(source);
  const result = addQrPortrait(source, width, await photo(), 256, matrix, 24);
  let protectedInside = 0;
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const mx = Math.floor(((x + 0.5) / width) * (matrix.size + 8)) - 4;
      const my = Math.floor(((y + 0.5) / width) * (matrix.size + 8)) - 4;
      const outside =
        Math.hypot(x + 0.5 - width / 2, y + 0.5 - width / 2) > width * 0.12;
      const reserved =
        mx >= 0 &&
        my >= 0 &&
        mx < matrix.size &&
        my < matrix.size &&
        matrix.reservedBit[my * matrix.size + mx];
      if (reserved && !outside) protectedInside++;
      if (outside || reserved) {
        const i = (y * width + x) * 4;
        assert.deepEqual(result.subarray(i, i + 4), source.subarray(i, i + 4));
      }
    }
  assert.ok(
    protectedInside > 0,
    "exercise an alignment pattern beneath the portrait",
  );
  assert.deepEqual(source, before);
  assert.notDeepEqual(result, before);
});

test("portrait compositor rejects unbounded dimensions and invalid sizes", () => {
  const image = new Uint8ClampedArray(64 * 64 * 4);
  const matrix = createMatrix("https://x.com/");
  for (const size of [NaN, Infinity, 0, 9, 25, 100])
    assert.throws(() => addQrPortrait(image, 64, image, 64, matrix, size));
  assert.throws(() => addQrPortrait(image, 2000, image, 64, matrix, 20));
});
