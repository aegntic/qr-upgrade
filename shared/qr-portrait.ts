import type { Matrix } from "./qr";

/** Add a local portrait before decoding the finished image. This does not certify it. */
export function addQrPortrait(
  artwork: Uint8ClampedArray,
  width: number,
  portrait: Uint8ClampedArray,
  portraitWidth: number,
  matrix: Matrix,
  sizePercent: number,
  frame: "metal" | "plain" = "metal",
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    width < 64 ||
    width > 1536 ||
    artwork.length !== width * width * 4 ||
    !Number.isInteger(portraitWidth) ||
    portraitWidth < 16 ||
    portraitWidth > 1536 ||
    portrait.length !== portraitWidth * portraitWidth * 4 ||
    !Number.isFinite(sizePercent) ||
    sizePercent < 10 ||
    sizePercent > 24
  )
    throw new Error("Choose a square portrait and a size between 10% and 24%.");
  const output = new Uint8ClampedArray(artwork);
  const center = width / 2;
  const radius = (width * sizePercent) / 200;
  const photoRadius = radius * 0.88;
  const side = matrix.size + 8;
  for (
    let y = Math.floor(center - radius);
    y < Math.ceil(center + radius);
    y++
  ) {
    for (
      let x = Math.floor(center - radius);
      x < Math.ceil(center + radius);
      x++
    ) {
      const dx = x + 0.5 - center,
        dy = y + 0.5 - center;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const mx = Math.floor(((x + 0.5) / width) * side) - 4;
      const my = Math.floor(((y + 0.5) / width) * side) - 4;
      // Alignment and other function patterns must remain visible even beneath a portrait.
      if (matrix.reservedBit[my * matrix.size + mx]) continue;
      const offset = (y * width + x) * 4;
      const edge = Math.min(1, radius - distance);
      const angle = Math.atan2(dy, dx);
      const metal = Math.max(
        35,
        Math.min(
          249,
          169 +
            66 * Math.cos(angle * 2 - 0.6) +
            19 * Math.sin(y * 2.7) +
            26 *
              Math.cos(
                ((distance - photoRadius) / (radius - photoRadius)) *
                  Math.PI *
                  2,
              ),
        ),
      );
      const inPhoto = Math.max(0, Math.min(1, photoRadius - distance));
      const px = Math.min(
        portraitWidth - 1,
        Math.max(0, Math.floor((dx / (photoRadius * 2) + 0.5) * portraitWidth)),
      );
      const py = Math.min(
        portraitWidth - 1,
        Math.max(0, Math.floor((dy / (photoRadius * 2) + 0.5) * portraitWidth)),
      );
      const sample = (py * portraitWidth + px) * 4;
      const alpha = portrait[sample + 3] / 255;
      for (let c = 0; c < 3; c++) {
        const color = portrait[sample + c] * alpha + 255 * (1 - alpha);
        const value =
          (frame === "plain" ? 255 : metal) * (1 - inPhoto) + color * inPhoto;
        output[offset + c] = artwork[offset + c] * (1 - edge) + value * edge;
      }
      output[offset + 3] = 255;
    }
  }
  return output;
}
