"use client";

import type { Content } from "@/lib/qr";
import type { ReactNode } from "react";
import {
  contentTypeForDestination,
  destinations,
  type DestinationId,
} from "@/lib/generator-options";

type Props = {
  kind: DestinationId;
  content: Content;
  onChange: (next: Content) => void;
};

export function DestinationFields({ kind, content, onChange }: Props) {
  const type = contentTypeForDestination(kind);
  const destination = destinations.find((item) => item.id === kind)!;
  const set = (field: keyof Content, value: string | boolean) =>
    onChange({ ...content, type, [field]: value });

  if (type === "url")
    return <Field label={destination.field} value={content.url} placeholder={destination.placeholder} type="url" onChange={(value) => set("url", value)} />;
  if (type === "text")
    return <Field label="Text" value={content.text || ""} placeholder={destination.placeholder} onChange={(value) => set("text", value)} />;
  if (type === "phone")
    return <Field label="Phone number" value={content.phone} placeholder={destination.placeholder} type="tel" onChange={(value) => set("phone", value)} />;
  if (type === "sms")
    return <Fields><Field label="SMS phone number" value={content.phone} placeholder={destination.placeholder} type="tel" onChange={(value) => set("phone", value)} /><Field label="Message (optional)" value={content.smsMessage || ""} onChange={(value) => set("smsMessage", value)} /></Fields>;
  if (type === "email")
    return <Fields><Field label="Email address" value={content.email} placeholder={destination.placeholder} type="email" onChange={(value) => set("email", value)} /><Field label="Subject (optional)" value={content.emailSubject || ""} onChange={(value) => set("emailSubject", value)} /><Field label="Message (optional)" value={content.emailBody || ""} onChange={(value) => set("emailBody", value)} /></Fields>;
  if (type === "whatsapp")
    return <Fields><Field label="WhatsApp phone number with country code" value={content.phone} placeholder={destination.placeholder} type="tel" onChange={(value) => set("phone", value)} /><Field label="Ready-to-send message (optional)" value={content.whatsappMessage || ""} onChange={(value) => set("whatsappMessage", value)} /></Fields>;
  if (type === "location")
    return <Fields><Field label="Latitude (-90 to 90)" value={content.latitude || ""} placeholder="-33.8688" inputMode="decimal" onChange={(value) => set("latitude", value)} /><Field label="Longitude (-180 to 180)" value={content.longitude || ""} placeholder="151.2093" inputMode="decimal" onChange={(value) => set("longitude", value)} /></Fields>;
  if (type === "event")
    return <Fields><Field label="Event title" value={content.eventTitle || ""} onChange={(value) => set("eventTitle", value)} /><div className="generator-pair"><Field label="Start date and time" value={content.eventStart || ""} type="datetime-local" onChange={(value) => set("eventStart", value)} /><Field label="End date and time" value={content.eventEnd || ""} type="datetime-local" onChange={(value) => set("eventEnd", value)} /></div><Field label="Timezone (IANA name, optional)" value={content.eventTimezone || ""} placeholder="Australia/Sydney" onChange={(value) => set("eventTimezone", value)} /><Field label="Location (optional)" value={content.eventLocation || ""} onChange={(value) => set("eventLocation", value)} /><Field label="Description (optional)" value={content.eventDescription || ""} onChange={(value) => set("eventDescription", value)} /></Fields>;
  if (type === "wifi")
    return <Fields><Field label="Network name" value={content.ssid} onChange={(value) => set("ssid", value)} /><label className="generator-field"><span>Security</span><select value={content.wifiEncryption || (content.password ? "WPA" : "nopass")} onChange={(event) => set("wifiEncryption", event.target.value)}><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">No password</option></select></label>{content.wifiEncryption !== "nopass" && <Field label="Wi-Fi password" value={content.password} type="password" onChange={(value) => set("password", value)} />}<label className="generator-field"><input type="checkbox" checked={content.wifiHidden || false} onChange={(event) => set("wifiHidden", event.target.checked)} /> <span>Hidden network</span></label><p className="generator-note">Anyone scanning this QR can read the network credentials.</p></Fields>;
  return <Fields><Field label="Full name" value={content.name} onChange={(value) => set("name", value)} /><div className="generator-pair"><Field label="Email" value={content.email} type="email" onChange={(value) => set("email", value)} /><Field label="Phone" value={content.phone} type="tel" onChange={(value) => set("phone", value)} /></div><Field label="Company (optional)" value={content.company || ""} onChange={(value) => set("company", value)} /><Field label="Job title (optional)" value={content.title || ""} onChange={(value) => set("title", value)} /><Field label="Website (optional)" value={content.website || ""} type="url" onChange={(value) => set("website", value)} /><Field label="Address (optional)" value={content.address || ""} onChange={(value) => set("address", value)} /></Fields>;
}

function Fields({ children }: { children: ReactNode }) {
  return <div className="generator-fields">{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "decimal" }) {
  return <label className="generator-field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} maxLength={1200} inputMode={inputMode} autoComplete="off" onChange={(event) => onChange(event.target.value)} /></label>;
}
