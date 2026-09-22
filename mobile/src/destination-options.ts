import type { Content, ContentType } from "../../shared/qr";

export const destinationOptions = Object.freeze([
  { value: "url", label: "Website" },
  { value: "text", label: "Text" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "location", label: "Coordinates" },
  { value: "event", label: "Calendar event" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "vcard", label: "Contact" },
] satisfies ReadonlyArray<{ value: ContentType; label: string }>);

export type WifiEncryption = NonNullable<Content["wifiEncryption"]>;

export function visibleWifiEncryption(content: Content): WifiEncryption {
  return content.wifiEncryption || (content.password ? "WPA" : "nopass");
}

/** Selecting an open network must immediately discard any retained secret. */
export function withWifiEncryption(
  content: Content,
  wifiEncryption: WifiEncryption,
): Content {
  return {
    ...content,
    wifiEncryption,
    password: wifiEncryption === "nopass" ? "" : content.password,
  };
}
