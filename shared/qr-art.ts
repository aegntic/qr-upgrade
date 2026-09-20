import type { Matrix } from "./qr";

/** Repair luminance in an artwork's sampling regions without replacing it with flat QR modules. */
export function integrateQrArtwork(
  source: Uint8ClampedArray,
  width: number,
  matrix: Matrix,
  strength: number,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    width < 64 ||
    width > 1536 ||
    source.length !== width * width * 4
  )
    throw new Error("Artwork must be a bounded square RGBA image.");
  if (!Number.isFinite(strength) || strength < 0 || strength > 1)
    throw new Error(
      "Choose an image protection strength between zero and one.",
    );
  const output = new Uint8ClampedArray(source.length);
  const side = matrix.size + 8;
  const core = 0.04 + strength * 0.46;
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const alpha = source[offset + 3] / 255;
      const rgb = [0, 1, 2].map(
        (c) => source[offset + c] * alpha + 255 * (1 - alpha),
      );
      const mx = ((x + 0.5) / width) * side - 4;
      const my = ((y + 0.5) / width) * side - 4;
      const quiet = mx < 0 || my < 0 || mx >= matrix.size || my >= matrix.size;
      const cell = Math.floor(my) * matrix.size + Math.floor(mx);
      const dark = !quiet && matrix.data[cell] === 1;
      const reserved = !quiet && matrix.reservedBit[cell] === 1;
      const distance = Math.max(
        Math.abs((mx % 1) - 0.5),
        Math.abs((my % 1) - 0.5),
      );
      // Wide, soft repair areas keep image detail visible and avoid hard overlay edges.
      const amount =
        quiet || reserved
          ? 1
          : strength === 0
            ? 0
            : Math.min(1, Math.max(0, (core + 0.06 - distance) / 0.06));
      const luminance = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
      const target = quiet
        ? 242
        : dark
          ? 72 - strength * 28
          : 192 + strength * 42;
      const needsRepair = dark ? luminance > target : luminance < target;
      for (let c = 0; c < 3; c++) {
        let value = rgb[c];
        if (needsRepair) {
          const corrected = dark
            ? (value * target) / Math.max(1, luminance)
            : value +
              ((255 - value) * (target - luminance)) /
                Math.max(1, 255 - luminance);
          value += (corrected - value) * amount;
        }
        output[offset + c] = value;
      }
      output[offset + 3] = 255;
    }
  }
  return output;
}
