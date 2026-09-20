export type ExportFormat = "png" | "pdf";

type Verification = { key: string; ok: boolean; message: string };

export type ExportAttempt = {
  format: ExportFormat;
  key: string;
  expected: string;
  svg: string;
  sizeMm: number;
  web: boolean;
  currentKey: () => string;
  setBusy: (busy: boolean) => void;
  capture: (pixels: number) => Promise<string>;
  decode: (png: string, expected: string) => Promise<boolean>;
  acceptVerification: (verification: Verification) => boolean;
  exportFile: (
    format: ExportFormat,
    svg: string,
    png: string,
    sizeMm: number,
  ) => Promise<void>;
};

export function exportPixels(sizeMm: number) {
  return Math.min(6000, Math.max(1024, Math.ceil((sizeMm / 25.4) * 300)));
}

export async function runExportAttempt(input: ExportAttempt): Promise<string> {
  input.setBusy(true);
  try {
    const png = await input.capture(exportPixels(input.sizeMm));
    const ok = await input.decode(png, input.expected);
    if (input.currentKey() !== input.key)
      return "The design changed while export was prepared. Try again.";
    const accepted = input.acceptVerification({
      key: input.key,
      ok,
      message: ok ? "Export read-back passed." : "Export read-back failed.",
    });
    if (!accepted)
      return "The design changed while export was prepared. Try again.";
    if (!ok)
      throw new Error(
        "This QR did not decode. Return to Scan Lab and increase scan strength or repair scanability.",
      );
    await input.exportFile(
      input.format,
      input.svg,
      png,
      input.sizeMm,
    );
    return input.web
      ? "Download started."
      : "Share sheet closed. Check your chosen destination for the file.";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Export failed. Please try again.";
  } finally {
    input.setBusy(false);
  }
}
