export type PrintInput = {
  foreground: string;
  background: string;
  quietZone: number;
  sizeMm: number;
  distanceCm: number;
  modules: number;
};
export type Check = {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
};
export type Report = {
  score: number;
  checks: Check[];
  contrast: number;
  recommendedMm: number;
  moduleMm: number;
};
export function luminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Use six-digit hex colors.");
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
export function contrastRatio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function validatePrintInput(value: unknown): PrintInput {
  if (!value || typeof value !== "object")
    throw new Error("Provide print parameters as a JSON object.");
  const x = value as Record<string, unknown>;
  for (const color of ["foreground", "background"])
    if (
      typeof x[color] !== "string" ||
      !/^#[\da-f]{6}$/i.test(x[color] as string)
    )
      throw new Error(`${color} must be a six-digit hex color.`);
  const bounds: Record<string, [number, number]> = {
    quietZone: [0, 12],
    sizeMm: [5, 500],
    distanceCm: [5, 500],
    modules: [21, 177],
  };
  for (const [key, [min, max]] of Object.entries(bounds))
    if (
      typeof x[key] !== "number" ||
      !Number.isFinite(x[key]) ||
      (x[key] as number) < min ||
      (x[key] as number) > max
    )
      throw new Error(`${key} must be between ${min} and ${max}.`);
  if (!Number.isInteger(x.quietZone))
    throw new Error("quietZone must be an integer.");
  if (!Number.isInteger(x.modules) || ((x.modules as number) - 21) % 4 !== 0)
    throw new Error("modules must match a QR version (21, 25, …, 177).");
  return x as PrintInput;
}
// Advisory screening thresholds, not an ISO barcode grade or scan probability.
export function assessPrint(input: PrintInput): Report {
  const x = validatePrintInput(input),
    contrast = contrastRatio(x.foreground, x.background);
  const moduleMm = x.sizeMm / (x.modules + 2 * x.quietZone);
  const recommendedMm = Math.ceil(
    Math.max(x.distanceCm, (x.modules + 2 * Math.max(4, x.quietZone)) * 0.4),
  );
  const checks: Check[] = [
    {
      id: "contrast",
      title: "Color contrast",
      passed:
        contrast >= 4.5 && luminance(x.foreground) < luminance(x.background),
      detail: `${contrast.toFixed(1)}:1 contrast. Aim for dark modules on a light background at 4.5:1 or higher; this is a screening heuristic.`,
    },
    {
      id: "quiet",
      title: "Clear space",
      passed: x.quietZone >= 4,
      detail: `${x.quietZone} modules of quiet zone. Standard QR codes need at least four on every side.`,
    },
    {
      id: "density",
      title: "Module size",
      passed: moduleMm >= 0.4,
      detail: `${moduleMm.toFixed(2)} mm per module. Our conservative starting target is 0.40 mm; printer and material matter.`,
    },
    {
      id: "distance",
      title: "Viewing distance",
      passed: x.sizeMm >= x.distanceCm,
      detail: `${x.sizeMm} mm at ${x.distanceCm} cm. A 10:1 distance-to-width rule is an estimate, not a camera guarantee.`,
    },
  ];
  return {
    score: checks.filter((c) => c.passed).length * 25,
    checks,
    contrast,
    recommendedMm,
    moduleMm,
  };
}
export function autoFix(input: PrintInput): PrintInput {
  const x = {
    ...validatePrintInput(input),
    quietZone: Math.max(input.quietZone, 4),
  };
  if (
    contrastRatio(x.foreground, x.background) < 4.5 ||
    luminance(x.foreground) >= luminance(x.background)
  ) {
    x.background = "#ffffff";
    if (contrastRatio(x.foreground, x.background) < 4.5)
      x.foreground = "#193c2f";
  }
  x.sizeMm = Math.min(500, Math.max(x.sizeMm, assessPrint(x).recommendedMm));
  return x;
}
