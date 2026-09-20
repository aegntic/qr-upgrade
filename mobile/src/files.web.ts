import { decodePixels } from "../../shared/decode";
export async function decodePng(base64: string, expected: string) {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(image, 0, 0);
  return (
    decodePixels(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    ) === expected
  );
}
export async function exportFile(
  format: "svg" | "png" | "pdf",
  svg: string,
  png: string,
  sizeMm: number,
) {
  if (format === "pdf")
    throw new Error(
      "PDF sharing is available in the Android and iOS apps, or use the web studio.",
    );
  const href =
    format === "svg"
      ? URL.createObjectURL(
          new Blob(
            [
              svg.replace(
                'width="768" height="768"',
                `width="${sizeMm}mm" height="${sizeMm}mm"`,
              ),
            ],
            { type: "image/svg+xml" },
          ),
        )
      : `data:image/png;base64,${png}`;
  const a = document.createElement("a");
  a.href = href;
  a.download = `qrupgrade.${format}`;
  a.click();
  if (format === "svg") setTimeout(() => URL.revokeObjectURL(href), 1000);
}
