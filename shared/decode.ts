import jsQR from "jsqr";

/** Read the rendered pixels at bounded scales. jsQR can miss large modules at high resolution. */
export function decodePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): string | undefined {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  )
    return;
  for (const limit of [1024, 384]) {
    const scale = Math.min(1, limit / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale));
    let data = pixels;
    if (scale < 1) {
      data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const from =
            (Math.min(height - 1, Math.floor((y + 0.5) / scale)) * width +
              Math.min(width - 1, Math.floor((x + 0.5) / scale))) *
            4;
          const to = (y * w + x) * 4;
          data.set(pixels.subarray(from, from + 4), to);
        }
    }
    const result = jsQR(data, w, h, { inversionAttempts: "attemptBoth" });
    if (result) return result.data;
    if (Math.max(width, height) <= 384) break;
  }
}
