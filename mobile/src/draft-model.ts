import { Appearance, Content, ContentType, payload } from "../../shared/qr";
import proofs from "../../src/lib/artwork-proofs.json";
export type Scene = "packaging" | "poster" | "card";
export type Draft = {
  artwork: string;
  artworkUri: string | null;
  portraitUri: string | null;
  portraitSize: number;
  strength: number;
  content: Content;
  appearance: Appearance;
  brand: string;
  sizeMm: number;
  distanceCm: number;
  scene: Scene;
  photo: string | null;
  x: number;
  y: number;
  rotation: number;
};
export const initialDraft: Draft = {
  artwork: "dragon",
  artworkUri: null,
  portraitUri: null,
  portraitSize: 20,
  strength: proofs.dragon.strength,
  content: {
    type: "url",
    url: "https://qrupgrade.com/",
    ssid: "",
    password: "",
    name: "",
    email: "",
    phone: "",
  },
  appearance: {
    foreground: "#193c2f",
    background: "#ffffff",
    quietZone: 4,
    style: "soft",
  },
  brand: "Your Brand Here.",
  sizeMm: 70,
  distanceCm: 40,
  scene: "packaging",
  photo: null,
  x: 50,
  y: 52,
  rotation: 0,
};

export const artworkIds = ["alpine", "astral", "botanical", "citrus", "city", "coffee", "dragon", "fox", "koi", "ocean", "orchid", "tiger", "vinyl", "wave", "custom"] as const;
export type AssetRole = "artwork" | "portrait" | "scene";
export type DraftSnapshot = Omit<Draft, "artworkUri" | "portraitUri" | "photo"> & {
  artworkUri: "artwork" | null;
  portraitUri: "portrait" | null;
  photo: "scene" | null;
};
const activeFields: Record<ContentType, readonly (keyof Content)[]> = {
  url: ["url"], text: ["text"], phone: ["phone"], sms: ["phone", "smsMessage"],
  email: ["email", "emailSubject", "emailBody"], whatsapp: ["phone", "whatsappMessage"],
  location: ["latitude", "longitude"],
  event: ["eventTitle", "eventStart", "eventEnd", "eventTimezone", "eventLocation", "eventDescription"],
  wifi: ["ssid", "password", "wifiEncryption", "wifiHidden"],
  vcard: ["name", "phone", "email", "company", "title", "website", "address"],
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved design.");
  return value as Record<string, unknown>;
}
export function boundedString(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function numberIn(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("Saved design setting is out of range.");
  return value;
}
/** Only the active destination is copied. Discarded credentials never reach JSON. */
export function snapshotContent(value: unknown): Content {
  const input = object(value);
  if (typeof input.type !== "string" || !Object.hasOwn(activeFields, input.type)) throw new Error("Choose a supported destination.");
  const type = input.type as ContentType;
  const result: Content = { type, url: "", ssid: "", password: "", name: "", email: "", phone: "" };
  for (const field of activeFields[type]) {
    const value = input[field];
    if (value === undefined) continue;
    if (field === "wifiHidden") {
      if (typeof value !== "boolean") throw new Error("Invalid Wi-Fi visibility.");
      result.wifiHidden = value;
    } else if (field === "wifiEncryption") {
      if (!["WPA", "WEP", "nopass"].includes(value as string)) throw new Error("Invalid Wi-Fi security.");
      result.wifiEncryption = value as Content["wifiEncryption"];
    } else {
      (result as unknown as Record<string, unknown>)[field] = boundedString(value, 1200, "destination field");
    }
  }
  if (type === "wifi" && result.wifiEncryption === "nopass") result.password = "";
  payload(result);
  return result;
}
/** Validated persistence snapshot. Track invalid in-progress edits separately in the UI. */
export function snapshotDraft(value: unknown): DraftSnapshot {
  const d = object(value), a = object(d.appearance);
  if (!artworkIds.includes(d.artwork as typeof artworkIds[number])) throw new Error("Invalid artwork direction.");
  if (!["packaging", "poster", "card"].includes(d.scene as string)) throw new Error("Invalid scene.");
  if (!["square", "soft", "dot"].includes(a.style as string)) throw new Error("Invalid QR style.");
  for (const color of [a.foreground, a.background]) if (typeof color !== "string" || !/^#[\da-f]{6}$/i.test(color)) throw new Error("Invalid color.");
  const quietZone = numberIn(a.quietZone, 4, 12);
  if (!Number.isInteger(quietZone)) throw new Error("Invalid quiet zone.");
  const reference = (field: unknown, role: AssetRole) => {
    if (field === null) return null;
    if (typeof field !== "string" || !field.length) throw new Error("Invalid image selection.");
    return role;
  };
  const artworkUri = d.artwork === "custom" ? reference(d.artworkUri, "artwork") as "artwork" | null : null;
  if (d.artwork === "custom" && !artworkUri) throw new Error("Choose a custom image.");
  return {
    artwork: d.artwork as string, artworkUri,
    portraitUri: reference(d.portraitUri, "portrait") as "portrait" | null,
    photo: reference(d.photo, "scene") as "scene" | null,
    portraitSize: numberIn(d.portraitSize, 10, 24), strength: numberIn(d.strength, 0, 1),
    content: snapshotContent(d.content),
    appearance: { foreground: a.foreground as string, background: a.background as string, quietZone, style: a.style as Appearance["style"] },
    brand: boundedString(d.brand, 120, "brand"), sizeMm: numberIn(d.sizeMm, 10, 2000),
    distanceCm: numberIn(d.distanceCm, 10, 200), scene: d.scene as Scene,
    x: numberIn(d.x, 0, 100), y: numberIn(d.y, 0, 100), rotation: numberIn(d.rotation, -45, 45),
  };
}
