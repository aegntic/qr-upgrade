import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import studies from "../src/lib/brand-studies.json";
import proofs from "../src/lib/brand-study-proofs.json";
import { decodePixels } from "../shared/decode";

for (const study of studies) {
  test(`${study.name} artwork and downloadable PNG encode the stated destination`, async () => {
    const proof = (
      proofs as Record<
        string,
        { destination: string; strength: number; verifiedWidths: number[] }
      >
    )[study.id];
    assert.equal(proof.destination, study.destination);
    assert.ok(proof.strength >= 0 && proof.strength <= 1);
    assert.deepEqual(proof.verifiedWidths, [184, 256, 512, 768]);
    for (const format of ["png", "webp"]) {
      for (const width of proof.verifiedWidths) {
        const data = await sharp(`public/brand-studies/${study.id}.${format}`)
          .resize(width, width)
          .ensureAlpha()
          .raw()
          .toBuffer();
        assert.equal(
          decodePixels(new Uint8ClampedArray(data), width, width),
          study.destination,
          `${study.id} ${format} at ${width}px`,
        );
      }
    }
  });
}
