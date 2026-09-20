import { integrateQrArtwork } from "../../shared/qr-art";
import { addQrPortrait } from "../../shared/qr-portrait";
import { createMatrix } from "./qr";
import { readCanvas } from "./browser-qr";

export async function createQrImage(
  src: string,
  text: string,
  strength: number,
  portrait?: { src: string; sizePercent: number; frame?: "metal" | "plain" },
  repairArtwork = true,
) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (!image.width || !image.height || image.width * image.height > 40000000)
    throw new Error("Choose artwork below 40 megapixels.");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");
  const crop = Math.min(image.width, image.height);
  ctx.drawImage(
    image,
    (image.width - crop) / 2,
    (image.height - crop) / 2,
    crop,
    crop,
    0,
    0,
    768,
    768,
  );
  const source = ctx.getImageData(0, 0, 768, 768);
  const matrix = createMatrix(text);
  let pixels = repairArtwork
    ? integrateQrArtwork(source.data, 768, matrix, strength)
    : source.data;
  if (portrait) {
    const photo = new Image();
    photo.src = portrait.src;
    await photo.decode().catch(() => {
      throw new Error(
        "The profile photo could not be opened. Try a different PNG or JPEG.",
      );
    });
    if (!photo.width || !photo.height || photo.width * photo.height > 40000000)
      throw new Error("Choose a portrait below 40 megapixels.");
    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = photoCanvas.height = 256;
    const photoContext = photoCanvas.getContext("2d");
    if (!photoContext) throw new Error("Canvas is unavailable.");
    const crop = Math.min(photo.width, photo.height);
    photoContext.drawImage(
      photo,
      (photo.width - crop) / 2,
      (photo.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      256,
      256,
    );
    pixels = addQrPortrait(
      pixels,
      768,
      photoContext.getImageData(0, 0, 256, 256).data,
      256,
      matrix,
      portrait.sizePercent,
      portrait.frame,
    );
  }
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), 768, 768),
    0,
    0,
  );
  const pristine = readCanvas(canvas) === text;
  const small = document.createElement("canvas");
  small.width = small.height = 256;
  small.getContext("2d")!.drawImage(canvas, 0, 0, 256, 256);
  const reduced = readCanvas(small) === text;
  const png = canvas.toDataURL("image/png");
  // Only the locally produced PNG is embedded; uploaded SVG/HTML never enters the document.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><image width="768" height="768" href="${png}"/></svg>`;
  return { png, svg, pristine, reduced };
}
