import { decodePixels } from "../../shared/decode";
const MIN_PDF_SIZE_MM = 10;
const MAX_PDF_SIZE_MM = 2000;

function validPdfSize(sizeMm: number) {
  if (
    !Number.isFinite(sizeMm) ||
    sizeMm < MIN_PDF_SIZE_MM ||
    sizeMm > MAX_PDF_SIZE_MM
  )
    throw new Error("Choose a PDF size between 10 and 2,000 mm.");
}

/** Builds a single square RGB page from the captured PNG used by the decode gate. */
export async function createPdfBytes(png: string, sizeMm: number) {
  validPdfSize(sizeMm);
  if (!png) throw new Error("The captured QR image is unavailable.");
  // The explicit ESM/browser entry keeps Expo's static Node renderer from
  // selecting jsPDF's CommonJS node build while preserving a web-only import.
  // @ts-expect-error jsPDF publishes types only for its package root.
  const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
  const document = new jsPDF({
    unit: "mm",
    format: [sizeMm, sizeMm],
    orientation: "portrait",
    compress: false,
    precision: 12,
  });
  document.addImage(
    `data:image/png;base64,${png}`,
    "PNG",
    0,
    0,
    sizeMm,
    sizeMm,
  );
  return document.output("arraybuffer");
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
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
  if (format === "pdf") {
    const bytes = await createPdfBytes(png, sizeMm);
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), "qrupgrade.pdf");
    return;
  }
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
  document.body.append(a);
  a.click();
  a.remove();
  if (format === "svg") setTimeout(() => URL.revokeObjectURL(href), 1000);
}
