import { File, Paths } from "expo-file-system";
import { scanFromURLAsync } from "expo-camera";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
function temp(name: string, content: string, base64 = false) {
  const f = new File(Paths.cache, `qrupgrade-${Date.now()}-${name}`);
  f.write(content, { encoding: base64 ? "base64" : "utf8" });
  return f;
}
export async function decodePng(base64: string, expected: string) {
  const file = temp("check.png", base64, true);
  try {
    const results = await scanFromURLAsync(file.uri, ["qr"]);
    return results.some((r) => r.data === expected);
  } finally {
    if (file.exists) file.delete();
  }
}
export async function exportFile(
  format: "svg" | "png" | "pdf",
  svg: string,
  png: string,
  sizeMm: number,
) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  let file: File;
  if (format === "pdf") {
    const result = await Print.printToFileAsync({
      html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/><style>@page{size:${sizeMm}mm ${sizeMm}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:100%;height:100%}</style></head><body><img src="data:image/png;base64,${png}"/></body></html>`,
      width: (sizeMm / 25.4) * 72,
      height: (sizeMm / 25.4) * 72,
    });
    file = new File(result.uri);
  } else
    file = temp(
      `code.${format}`,
      format === "svg"
        ? svg.replace(
            'width="768" height="768"',
            `width="${sizeMm}mm" height="${sizeMm}mm"`,
          )
        : png,
      format === "png",
    );
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType:
        format === "svg"
          ? "image/svg+xml"
          : format === "pdf"
            ? "application/pdf"
            : "image/png",
      dialogTitle: "Export QR Upgrade",
      UTI:
        format === "pdf"
          ? "com.adobe.pdf"
          : format === "png"
            ? "public.png"
            : "public.svg-image",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
