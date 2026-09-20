import QRCode from "qrcode/lib/core/qrcode";
export type ContentType = "url" | "wifi" | "vcard";
export type Content = {
  type: ContentType;
  url: string;
  ssid: string;
  password: string;
  name: string;
  email: string;
  phone: string;
};
export type Style = "square" | "soft" | "dot";
export type Appearance = {
  foreground: string;
  background: string;
  quietZone: number;
  style: Style;
};
export type Matrix = {
  size: number;
  data: Uint8Array;
  reservedBit: Uint8Array;
};
const escWifi = (s: string) => s.replace(/[\\;,:\"]/g, "\\$&");
const escVcard = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[;,]/g, "\\$&");
export function payload(content: Content): string {
  if (!content || !["url", "wifi", "vcard"].includes(content.type))
    throw new Error("Choose a supported QR content type.");
  for (const field of [
    "url",
    "ssid",
    "password",
    "name",
    "email",
    "phone",
  ] as const) {
    if (typeof content[field] !== "string" || content[field].length > 1200)
      throw new Error("Invalid or oversized QR content.");
  }
  let result = "";
  if (content.type === "url") {
    const value = content.url.trim();
    try {
      const u = new URL(value);
      if (
        !["https:", "http:"].includes(u.protocol) ||
        u.username ||
        u.password ||
        /[\u0000-\u001f\u007f]/.test(value)
      )
        throw new Error();
      result = u.href;
    } catch {
      throw new Error("Enter a full https:// or http:// website address.");
    }
  } else if (content.type === "wifi") {
    if (!content.ssid.trim()) throw new Error("Enter your Wi-Fi network name.");
    result = `WIFI:T:${content.password ? "WPA" : "nopass"};S:${escWifi(content.ssid)};P:${escWifi(content.password)};;`;
  } else {
    if (!content.name.trim()) throw new Error("Enter a contact name.");
    result = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${escVcard(content.name)}\r\nTEL:${escVcard(content.phone)}\r\nEMAIL:${escVcard(content.email)}\r\nEND:VCARD`;
  }
  if (new TextEncoder().encode(result).length > 1200)
    throw new Error(
      "Keep the encoded content below 1,200 bytes for a practical print size.",
    );
  return result;
}
export function createMatrix(text: string): Matrix {
  return QRCode.create(text, { errorCorrectionLevel: "H" }).modules as Matrix;
}
export function qrSvg(matrix: Matrix, a: Appearance): string {
  const side = matrix.size + a.quietZone * 2;
  if (
    !/^#[\da-f]{6}$/i.test(a.foreground) ||
    !/^#[\da-f]{6}$/i.test(a.background)
  )
    throw new Error("Invalid color.");
  let marks = "";
  for (let y = 0; y < matrix.size; y++)
    for (let x = 0; x < matrix.size; x++) {
      const i = y * matrix.size + x;
      if (!matrix.data[i]) continue;
      const px = x + a.quietZone,
        py = y + a.quietZone;
      const reserved = matrix.reservedBit[i] === 1;
      if (a.style === "dot" && !reserved)
        marks += `<circle cx="${px + 0.5}" cy="${py + 0.5}" r="0.48"/>`;
      else
        marks += `<rect x="${px}" y="${py}" width="1" height="1"${a.style === "soft" && !reserved ? ' rx="0.2"' : ""}/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="768" height="768"><rect width="${side}" height="${side}" fill="${a.background}"/><g fill="${a.foreground}">${marks}</g></svg>`;
}
export function svgData(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
