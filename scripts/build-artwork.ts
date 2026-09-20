import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { createMatrix } from "../shared/qr";
import { integrateQrArtwork } from "../shared/qr-art";
import { decodePixels } from "../shared/decode";
import { artworkDesigns, artDestination } from "../src/lib/artwork-designs";

async function main() {
  const size = 768;
  const matrix = createMatrix(artDestination);
  const proofs: Record<
    string,
    { strength: number; verifiedWidths: number[]; destination: string }
  > = {};
  for (const design of artworkDesigns) {
    const { data } = await sharp(`public/artwork/${design.id}-source.png`)
      .resize(size, size, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let success = false;
    for (const strength of [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6, 0.8, 1]) {
      const pixels = integrateQrArtwork(
        new Uint8ClampedArray(data),
        size,
        matrix,
        strength,
      );
      const png = await sharp(pixels, {
        raw: { width: size, height: size, channels: 4 },
      })
        .png()
        .toBuffer();
      const widths = [184, 256, 512, 768];
      let passed = true;
      for (const width of widths) {
        const scaled = await sharp(png)
          .resize(width, width)
          .ensureAlpha()
          .raw()
          .toBuffer();
        if (
          decodePixels(new Uint8ClampedArray(scaled), width, width) !==
          artDestination
        ) {
          passed = false;
          break;
        }
      }
      if (!passed) continue;
      await sharp(png)
        .webp({ lossless: true })
        .toFile(`public/artwork/${design.id}.webp`);
      proofs[design.id] = {
        strength,
        verifiedWidths: widths,
        destination: artDestination,
      };
      console.log(design.name, "passed at", strength);
      success = true;
      break;
    }
    if (!success) throw new Error(`Artwork did not pass: ${design.id}`);
  }
  await writeFile(
    "src/lib/artwork-proofs.json",
    JSON.stringify(proofs, null, 2) + "\n",
  );
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
