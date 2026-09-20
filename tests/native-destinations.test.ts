import { test } from "node:test";
import assert from "node:assert/strict";
import { payload, type Content } from "../shared/qr";
import {
  destinationOptions,
  visibleWifiEncryption,
  withWifiEncryption,
} from "../mobile/src/destination-options";
import { snapshotContent } from "../mobile/src/draft-model";

const base: Content = {
  type: "url",
  url: "",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};

const cases: Array<[Content, string]> = [
  [{ ...base, type: "url", url: "https://example.com/a?x=1" }, "https://example.com/a?x=1"],
  [{ ...base, type: "text", text: "Tea ☕" }, "Tea ☕"],
  [{ ...base, type: "phone", phone: "+61 400 123 456" }, "tel:%2B61%20400%20123%20456"],
  [{ ...base, type: "sms", phone: "+1 555", smsMessage: "Meet & eat" }, "sms:%2B1%20555?body=Meet%20%26%20eat"],
  [{ ...base, type: "email", email: "hello@example.com", emailSubject: "Hello", emailBody: "One two" }, "mailto:hello%40example.com?subject=Hello&body=One+two"],
  [{ ...base, type: "whatsapp", phone: "+61 412-345-678", whatsappMessage: "Hello" }, "https://wa.me/61412345678?text=Hello"],
  [{ ...base, type: "location", latitude: "-90", longitude: "180" }, "geo:-90,180"],
  [{ ...base, type: "event", eventTitle: "Launch", eventStart: "2026-10-02T18:30", eventEnd: "2026-10-02T20:00", eventTimezone: "Australia/Sydney" }, "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Launch\r\nDTSTART;TZID=Australia/Sydney:20261002T183000\r\nDTEND;TZID=Australia/Sydney:20261002T200000\r\nEND:VEVENT\r\nEND:VCALENDAR"],
  [{ ...base, type: "wifi", ssid: " Guest ", password: " pass ", wifiEncryption: "WPA", wifiHidden: true }, "WIFI:T:WPA;S: Guest ;P: pass ;H:true;;"],
  [{ ...base, type: "vcard", name: "Ada Lovelace", phone: "+44 20", email: "ada@example.com", company: "Engines", title: "Founder", website: "https://example.com/about", address: "1 Main St" }, "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada Lovelace\r\nORG:Engines\r\nTITLE:Founder\r\nTEL:+44 20\r\nEMAIL:ada@example.com\r\nURL:https://example.com/about\r\nADR:;;1 Main St;;;;\r\nEND:VCARD"],
];

test("offers every shared destination exactly once", () => {
  assert.deepEqual(
    destinationOptions.map(({ value }) => value),
    ["url", "text", "phone", "sms", "email", "whatsapp", "location", "event", "wifi", "vcard"],
  );
});

test("all ten active destinations persist and retain exact shared payloads", () => {
  for (const [content, expected] of cases) {
    assert.equal(payload(content), expected, content.type);
    const saved = snapshotContent({
      ...content,
      url: content.type === "url" ? content.url : "https://discard.example/",
      password: content.type === "wifi" ? content.password : "discard-secret",
      company: content.type === "vcard" ? content.company : "discard-company",
    });
    assert.equal(payload(saved), expected, `${content.type} after snapshot`);
    if (content.type !== "url") assert.equal(saved.url, "");
    if (content.type !== "wifi") assert.equal(saved.password, "");
    if (content.type !== "vcard") assert.equal(saved.company, undefined);
  }
});

test("Wi-Fi security transition clears only an open network password", () => {
  const secured = { ...base, type: "wifi" as const, ssid: " Guest ", password: " pass " };
  assert.equal(visibleWifiEncryption(secured), "WPA");
  const wep = withWifiEncryption(secured, "WEP");
  assert.equal(wep.password, " pass ");
  assert.equal(wep.ssid, " Guest ");
  const open = withWifiEncryption(wep, "nopass");
  assert.equal(open.password, "");
  assert.equal(payload(open), "WIFI:T:nopass;S: Guest ;P:;;");
});

test("shared validation rejects injection, Unicode byte overflow and boundaries", () => {
  assert.throws(() => snapshotContent({ ...base, type: "sms", phone: "+1\nTEL:evil" }), /SMS phone/);
  assert.throws(() => snapshotContent({ ...base, type: "text", text: "😀".repeat(301) }), /1,200 bytes/);
  assert.throws(() => snapshotContent({ ...base, type: "location", latitude: "90.0001", longitude: "0" }), /Latitude/);
  assert.throws(() => snapshotContent({ ...base, type: "phone", phone: "abc123" }), /valid phone/);
  assert.throws(() => snapshotContent({ ...base, type: "vcard", name: "Ada", website: "https://user:pass@example.com" }), /website address/);
  assert.throws(() => snapshotContent({ ...base, type: "event", eventTitle: "Test", eventStart: "2026-02-30T10:00", eventEnd: "2026-03-03T10:00" }), /valid event start/);
  assert.throws(() => snapshotContent({ ...base, type: "event", eventTitle: "Test", eventStart: "2026-10-02T20:00", eventEnd: "2026-10-02T18:00" }), /after event start/);
  assert.throws(() => snapshotContent({ ...base, type: "event", eventTitle: "Test", eventStart: "2026-10-02T18:00", eventEnd: "2026-10-02T20:00", eventTimezone: "Mars/Olympus" }), /valid IANA timezone/);
});
