import QRCode from "qrcode/lib/core/qrcode";
export type ContentType =
  | "url"
  | "text"
  | "phone"
  | "sms"
  | "email"
  | "whatsapp"
  | "location"
  | "event"
  | "wifi"
  | "vcard";
export type Content = {
  type: ContentType;
  url: string;
  ssid: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  text?: string;
  smsMessage?: string;
  emailSubject?: string;
  emailBody?: string;
  whatsappMessage?: string;
  latitude?: string;
  longitude?: string;
  eventTitle?: string;
  eventStart?: string;
  eventEnd?: string;
  eventLocation?: string;
  eventDescription?: string;
  eventTimezone?: string;
  wifiEncryption?: "WPA" | "WEP" | "nopass";
  wifiHidden?: boolean;
  company?: string;
  title?: string;
  website?: string;
  address?: string;
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
const controls = /[\u0000-\u001f\u007f]/;
const lineControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const requireValue = (value: string | undefined, message: string) => {
  if (!value || controls.test(value)) throw new Error(message);
  const result = value.trim();
  if (!result) throw new Error(message);
  return result;
};
const safeOptional = (value: string | undefined) => {
  if (value && controls.test(value))
    throw new Error("Remove control characters from the QR content.");
  return value?.trim() || "";
};
const uri = (value: string) => encodeURIComponent(value);
const validPhone = (value: string) => /^\+?[\d\s().-]+$/.test(value) && /\d/.test(value);
const escCalendar = (value: string) => escVcard(value);
const calendarDate = (value: string, label: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  const date = match
    ? new Date(
        Number(match[1]), Number(match[2]) - 1, Number(match[3]),
        Number(match[4]), Number(match[5]), Number(match[6] || "0"),
      )
    : null;
  if (
    !match || !date || Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3]) ||
    date.getHours() !== Number(match[4]) ||
    date.getMinutes() !== Number(match[5])
  )
    throw new Error(`Enter a valid event ${label}.`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] || "00"}`;
};
export function payload(content: Content): string {
  if (
    !content ||
    ![
      "url", "text", "phone", "sms", "email", "whatsapp", "location",
      "event", "wifi", "vcard",
    ].includes(content.type)
  )
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
  for (const value of Object.values(content)) {
    if (typeof value === "string" && (value.length > 1200 || lineControls.test(value)))
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
  } else if (content.type === "text") {
    result = requireValue(content.text, "Enter text to encode.");
  } else if (content.type === "phone") {
    const phone = requireValue(content.phone, "Enter a phone number.");
    if (!validPhone(phone)) throw new Error("Enter a valid phone number.");
    result = `tel:${uri(phone)}`;
  } else if (content.type === "sms") {
    const phone = requireValue(content.phone, "Enter an SMS phone number.");
    if (!validPhone(phone)) throw new Error("Enter a valid SMS phone number.");
    const message = safeOptional(content.smsMessage);
    result = `sms:${uri(phone)}${message ? `?body=${uri(message)}` : ""}`;
  } else if (content.type === "email") {
    const email = requireValue(content.email, "Enter an email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a valid email address.");
    const params = new URLSearchParams();
    const subject = safeOptional(content.emailSubject);
    const body = safeOptional(content.emailBody);
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    result = `mailto:${uri(email)}${params.size ? `?${params}` : ""}`;
  } else if (content.type === "whatsapp") {
    const phone = requireValue(content.phone, "Enter a WhatsApp phone number.");
    if (!validPhone(phone))
      throw new Error("Enter a WhatsApp phone number with country code.");
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 6 || digits.length > 15)
      throw new Error("Enter a WhatsApp phone number with country code.");
    const message = safeOptional(content.whatsappMessage);
    result = `https://wa.me/${digits}${message ? `?text=${uri(message)}` : ""}`;
  } else if (content.type === "location") {
    const latitude = Number(requireValue(content.latitude, "Enter a latitude."));
    const longitude = Number(requireValue(content.longitude, "Enter a longitude."));
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      throw new Error("Latitude must be between -90 and 90.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      throw new Error("Longitude must be between -180 and 180.");
    result = `geo:${latitude},${longitude}`;
  } else if (content.type === "event") {
    const title = requireValue(content.eventTitle, "Enter an event title.");
    const startValue = requireValue(content.eventStart, "Enter an event start date and time.");
    const endValue = requireValue(content.eventEnd, "Enter an event end date and time.");
    if (new Date(endValue).getTime() <= new Date(startValue).getTime())
      throw new Error("Event end must be after event start.");
    const timezone = safeOptional(content.eventTimezone);
    if (timezone && !/^[A-Za-z0-9_+\-/]+$/.test(timezone))
      throw new Error("Enter a valid IANA timezone, such as Australia/Sydney.");
    if (timezone) {
      try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
      catch { throw new Error("Enter a valid IANA timezone, such as Australia/Sydney."); }
    }
    const zone = timezone ? `;TZID=${timezone}` : "";
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
      `SUMMARY:${escCalendar(title)}`,
      `DTSTART${zone}:${calendarDate(startValue, "start date and time")}`,
      `DTEND${zone}:${calendarDate(endValue, "end date and time")}`,
    ];
    const location = safeOptional(content.eventLocation);
    const description = safeOptional(content.eventDescription);
    if (location) lines.push(`LOCATION:${escCalendar(location)}`);
    if (description) lines.push(`DESCRIPTION:${escCalendar(description)}`);
    lines.push("END:VEVENT", "END:VCALENDAR");
    result = lines.join("\r\n");
  } else if (content.type === "wifi") {
    requireValue(content.ssid, "Enter your Wi-Fi network name.");
    const ssid = content.ssid;
    if (content.password && controls.test(content.password))
      throw new Error("Remove control characters from the Wi-Fi password.");
    const encryption = content.wifiEncryption || (content.password ? "WPA" : "nopass");
    if (!['WPA', 'WEP', 'nopass'].includes(encryption))
      throw new Error("Choose a supported Wi-Fi encryption type.");
    if (encryption !== "nopass" && !content.password)
      throw new Error("Enter the Wi-Fi password.");
    const password = encryption === "nopass" ? "" : content.password;
    result = `WIFI:T:${encryption};S:${escWifi(ssid)};P:${escWifi(password)};${content.wifiHidden ? "H:true;" : ""};`;
  } else {
    if (!content.name.trim()) throw new Error("Enter a contact name.");
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escVcard(content.name)}`];
    if (content.company) lines.push(`ORG:${escVcard(content.company)}`);
    if (content.title) lines.push(`TITLE:${escVcard(content.title)}`);
    lines.push(`TEL:${escVcard(content.phone)}`);
    lines.push(`EMAIL:${escVcard(content.email)}`);
    if (content.website) {
      let site: URL;
      try { site = new URL(content.website); } catch { throw new Error("Enter a full contact website address."); }
      if (!["http:", "https:"].includes(site.protocol) || site.username || site.password)
        throw new Error("Enter a full contact website address.");
      lines.push(`URL:${escVcard(site.href)}`);
    }
    if (content.address) lines.push(`ADR:;;${escVcard(content.address)};;;;`);
    lines.push("END:VCARD");
    result = lines.join("\r\n");
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
