import { decodePixels } from "../../shared/decode";
import { svgData } from "./qr";
export async function rasterize(
  svg: string,
  width = 768,
): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = svgData(svg);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser does not support the canvas editor.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, width);
  ctx.drawImage(image, 0, 0, width, width);
  return canvas;
}
export function readCanvas(canvas: HTMLCanvasElement): string | undefined {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodePixels(pixels.data, pixels.width, pixels.height);
}
export async function validateRendered(
  svg: string,
  text: string,
  options: {
    sizeMm: number;
    distanceCm: number;
    blur: number;
    rotation: number;
  },
) {
  const original = await rasterize(svg, 768);
  const pristine = readCanvas(original) === text;
  // Explicitly a reference-camera heuristic; scene photos do not set physical scale.
  const width = Math.max(
    40,
    Math.min(360, Math.round((options.sizeMm / options.distanceCm) * 160)),
  );
  const sim = document.createElement("canvas");
  sim.width = Math.ceil(width * 1.5) + 32;
  sim.height = sim.width;
  const ctx = sim.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sim.width, sim.height);
  ctx.translate(sim.width / 2, sim.height / 2);
  ctx.rotate((options.rotation * Math.PI) / 180);
  ctx.filter = `blur(${options.blur}px)`;
  ctx.drawImage(original, -width / 2, -width / 2, width, width);
  ctx.filter = "none";
  return { pristine, simulated: readCanvas(sim) === text, pixels: width };
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportQR(
  svg: string,
  format: "svg" | "png" | "pdf",
  sizeMm: number,
  filename = "qr-upgrade",
) {
  const basename = filename.replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/^\.+/, "").trim().slice(0, 80) || "qr-upgrade";
  if (format === "svg") {
    const printSvg = svg.replace(
      'width="768" height="768"',
      `width="${sizeMm}mm" height="${sizeMm}mm"`,
    );
    downloadBlob(
      new Blob([printSvg], { type: "image/svg+xml" }),
      `${basename}.svg`,
    );
    return;
  }
  const pixels = Math.ceil(Math.max(768, (sizeMm / 25.4) * 300));
  const canvas = await rasterize(svg, Math.min(pixels, 6000));
  if (format === "png") {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
        "image/png",
      ),
    );
    downloadBlob(blob, `${basename}.png`);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const side = Math.max(60, sizeMm + 20);
  const doc = new jsPDF({ unit: "mm", format: [side, side] });
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    (side - sizeMm) / 2,
    (side - sizeMm) / 2,
    sizeMm,
    sizeMm,
  );
  doc.save(`${basename}.pdf`);
}
export async function readLocalImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  const raw = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = raw;
    await image.decode();
    if (image.width * image.height > 40000000)
      throw new Error("Choose an image below 40 megapixels.");
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(raw);
  }
}
export async function extractColor(src: string): Promise<string> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#193c2f";
  ctx.drawImage(image, 0, 0, 40, 40);
  const data = ctx.getImageData(0, 0, 40, 40).data;
  const colors = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 180) continue;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    if (Math.min(...rgb) > 220 || Math.max(...rgb) < 18) continue;
    const key = rgb
      .map((v) =>
        Math.min(255, Math.round(v / 24) * 24)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
    colors.set(key, (colors.get(key) || 0) + 1);
  }
  return (
    "#" +
    ([...colors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "193c2f")
  );
}
