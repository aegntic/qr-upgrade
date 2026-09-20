import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createMatrix } from "../shared/qr";
import { integrateQrArtwork } from "../shared/qr-art";
import { decodePixels } from "../shared/decode";
import studies from "../src/lib/brand-studies.json";

async function main() {
  const proofs: Record<
    string,
    { strength: number; verifiedWidths: number[]; destination: string }
  > = {};
  const size = 768;
  for (const study of studies) {
    const source = await sharp(
      await readFile(`public/brand-studies/${study.id}-source.png`),
    )
      .resize(size, size, { fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const matrix = createMatrix(study.destination);
    let passed = false;
    for (const strength of [
      0, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1,
    ]) {
      const pixels = integrateQrArtwork(
        new Uint8ClampedArray(source),
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
      const results = await Promise.all(
        widths.map(async (width) => {
          const data = await sharp(png)
            .resize(width, width)
            .ensureAlpha()
            .raw()
            .toBuffer();
          return (
            decodePixels(new Uint8ClampedArray(data), width, width) ===
            study.destination
          );
        }),
      );
      if (!results.every(Boolean)) continue;
      await writeFile(`public/brand-studies/${study.id}.png`, png);
      await sharp(png)
        .webp({ lossless: true })
        .toFile(`public/brand-studies/${study.id}.webp`);
      proofs[study.id] = {
        strength,
        verifiedWidths: widths,
        destination: study.destination,
      };
      console.log(
        study.name,
        "decoded at",
        widths.join(", "),
        "px; strength",
        strength,
      );
      passed = true;
      break;
    }
    if (!passed) throw new Error(`No verified image for ${study.name}`);
  }
  await writeFile(
    "src/lib/brand-study-proofs.json",
    JSON.stringify(proofs, null, 2) + "\n",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
