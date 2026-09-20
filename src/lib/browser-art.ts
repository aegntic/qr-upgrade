import { integrateQrArtwork } from "../../shared/qr-art";
import { addQrPortrait } from "../../shared/qr-portrait";
import { createMatrix } from "./qr";
import { readCanvas } from "./browser-qr";
import {
  defaultCaption,
  defaultImageAdjustments,
  type Caption,
  type ImageAdjustments,
} from "./editor-draft";

export type Composition = {
  adjustments?: ImageAdjustments;
  caption?: Caption;
};

export function sourceCrop(width: number, height: number, value: ImageAdjustments) {
  const zoom = Math.max(1, Math.min(3, value.zoom));
  const size = Math.min(width, height) / zoom;
  return {
    x: (width - size) * (Math.max(0, Math.min(100, value.x)) / 100),
    y: (height - size) * (Math.max(0, Math.min(100, value.y)) / 100),
    size,
  };
}

export function compositionLayout(value: Caption) {
  const hasCaption = !!value.text.trim();
  const band = hasCaption ? 72 : 0;
  const qrSize = 768 - band;
  return { hasCaption, band, qrSize, qrLeft: band / 2, qrTop: hasCaption && value.position === "top" ? band : 0 };
}

export async function createQrImage(
  src: string,
  text: string,
  strength: number,
  portrait?: { src: string; sizePercent: number; frame?: "metal" | "plain" },
  repairArtwork = true,
  composition: Composition = {},
) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (!image.width || !image.height || image.width * image.height > 40000000)
    throw new Error("Choose artwork below 40 megapixels.");
  const adjustments = { ...defaultImageAdjustments, ...composition.adjustments };
  const caption = { ...defaultCaption, ...composition.caption };
  const { hasCaption, band, qrSize, qrLeft, qrTop } = compositionLayout(caption);
  const work = document.createElement("canvas");
  work.width = work.height = 768;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 768, 768);
  const crop = sourceCrop(image.width, image.height, adjustments);
  ctx.filter = `brightness(${Math.max(50, Math.min(150, adjustments.brightness))}%)`;
  ctx.globalAlpha = Math.max(20, Math.min(100, adjustments.opacity)) / 100;
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    768,
    768,
  );
  ctx.filter = "none";
  ctx.globalAlpha = 1;
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
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 768;
  const output = canvas.getContext("2d", { willReadFrequently: true });
  if (!output) throw new Error("Canvas is unavailable.");
  output.fillStyle = hasCaption ? caption.color : "#ffffff";
  output.fillRect(0, 0, 768, 768);
  output.drawImage(work, qrLeft, qrTop, qrSize, qrSize);
  if (hasCaption) {
    const family = caption.font === "serif" ? "Georgia, serif" : caption.font === "mono" ? "ui-monospace, monospace" : "system-ui, sans-serif";
    output.fillStyle = readableTextColor(caption.color);
    output.font = `600 24px ${family}`;
    output.textAlign = "center";
    output.textBaseline = "middle";
    const label = caption.text.trim().slice(0, 60);
    const maxWidth = 704;
    let shown = label;
    while (shown.length > 1 && output.measureText(shown).width > maxWidth)
      shown = `${shown.slice(0, -2)}…`;
    output.fillText(shown, 384, caption.position === "top" ? band / 2 : 768 - band / 2);
  }
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

function readableTextColor(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const number = Number.parseInt(full, 16);
  if (!Number.isFinite(number)) return "#111111";
  const r = number >> 16;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111111" : "#ffffff";
}
