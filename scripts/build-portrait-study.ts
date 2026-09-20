import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { createMatrix } from "../shared/qr";
import { integrateQrArtwork } from "../shared/qr-art";
import { addQrPortrait } from "../shared/qr-portrait";
import { decodePixels } from "../shared/decode";

async function main() {
  const width = 768;
  const destination = "https://x.com/";
  const matrix = createMatrix(destination);
  const source = new Uint8ClampedArray(
    await sharp("public/brand-studies/x-source.png")
      .resize(width, width)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  const portrait = new Uint8ClampedArray(
    await sharp("public/brand-studies/sample-portrait.png")
      .resize(256, 256)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
  for (const strength of [0, 0.025, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1]) {
    const pixels = addQrPortrait(
      integrateQrArtwork(source, width, matrix, strength),
      width,
      portrait,
      256,
      matrix,
      20,
    );
    const png = await sharp(pixels, {
      raw: { width, height: width, channels: 4 },
    })
      .png()
      .toBuffer();
    const verifiedWidths = [184, 256, 512, 768];
    const decoded = await Promise.all(
      verifiedWidths.map(async (size) => {
        const rgba = await sharp(png)
          .resize(size, size)
          .ensureAlpha()
          .raw()
          .toBuffer();
        return (
          decodePixels(new Uint8ClampedArray(rgba), size, size) === destination
        );
      }),
    );
    if (!decoded.every(Boolean)) continue;
    await writeFile("public/brand-studies/x-portrait.png", png);
    await writeFile(
      "src/lib/portrait-study-proof.json",
      JSON.stringify(
        {
          destination,
          strength,
          sizePercent: 20,
          verifiedWidths,
          portrait: "Fictional AI-generated sample person",
        },
        null,
        2,
      ) + "\n",
    );
    console.log({ destination, strength, sizePercent: 20, verifiedWidths });
    return;
  }
  throw new Error("Portrait study did not decode at every required size.");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
