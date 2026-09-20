import { test } from "node:test";
import assert from "node:assert/strict";
import { payload, type Content } from "../shared/qr";
import { contentTypeForDestination } from "../src/lib/generator-options";
import { withWifiEncryption } from "../src/components/destination-fields";

const base: Content = {
  type: "url",
  url: "https://qrupgrade.com/",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};

test("serializes phone, messaging and email destinations with encoded values", () => {
  assert.equal(payload({ ...base, type: "phone", phone: "+61 400 123 456" }), "tel:%2B61%20400%20123%20456");
  assert.equal(payload({ ...base, type: "sms", phone: "+1 555", smsMessage: "Meet at 5 & bring tea" }), "sms:%2B1%20555?body=Meet%20at%205%20%26%20bring%20tea");
  assert.equal(payload({ ...base, type: "email", email: "hello@example.com", emailSubject: "Hello & welcome", emailBody: "One two" }), "mailto:hello%40example.com?subject=Hello+%26+welcome&body=One+two");
  assert.equal(payload({ ...base, type: "whatsapp", phone: "+61 412-345-678", whatsappMessage: "Hello & welcome" }), "https://wa.me/61412345678?text=Hello%20%26%20welcome");
});

test("serializes text, coordinates, Wi-Fi and enriched contacts", () => {
  assert.equal(payload({ ...base, type: "text", text: "Order #104" }), "Order #104");
  assert.equal(payload({ ...base, type: "location", latitude: "-33.8688", longitude: "151.2093" }), "geo:-33.8688,151.2093");
  assert.equal(payload({ ...base, type: "wifi", ssid: "Studio", password: "secret", wifiEncryption: "WEP", wifiHidden: true }), "WIFI:T:WEP;S:Studio;P:secret;H:true;;");
  const card = payload({ ...base, type: "vcard", name: "Ada Lovelace", company: "Analytical; Engines", title: "Founder", website: "https://example.com/about", address: "1 Main St, Sydney" });
  assert.match(card, /ORG:Analytical\\; Engines/);
  assert.match(card, /TITLE:Founder/);
  assert.match(card, /URL:https:\/\/example.com\/about/);
  assert.match(card, /ADR:;;1 Main St\\, Sydney;;;;/);
});

test("preserves legacy Wi-Fi security fallback and omits retained open-network secrets", () => {
  assert.equal(payload({ ...base, type: "wifi", ssid: "Legacy", password: "secret" }), "WIFI:T:WPA;S:Legacy;P:secret;;");
  assert.equal(payload({ ...base, type: "wifi", ssid: "Guest", password: "retained-secret", wifiEncryption: "nopass" }), "WIFI:T:nopass;S:Guest;P:;;");
  const open = withWifiEncryption({ ...base, type: "wifi", ssid: "Guest", password: "secret", wifiEncryption: "WPA" }, "nopass");
  assert.equal(open.wifiEncryption, "nopass");
  assert.equal(open.password, "");
});

test("creates a VEVENT with explicit local dates and timezone", () => {
  const event = payload({ ...base, type: "event", eventTitle: "Launch, night", eventStart: "2026-10-02T18:30", eventEnd: "2026-10-02T20:00", eventTimezone: "Australia/Sydney", eventLocation: "Hall; A", eventDescription: "Doors open" });
  assert.match(event, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT/);
  assert.match(event, /SUMMARY:Launch\\, night/);
  assert.match(event, /DTSTART;TZID=Australia\/Sydney:20261002T183000/);
  assert.match(event, /DTEND;TZID=Australia\/Sydney:20261002T200000/);
  assert.match(event, /LOCATION:Hall\\; A/);
  assert.match(event, /END:VEVENT\r\nEND:VCALENDAR$/);
});

test("rejects missing required values, injection, invalid bounds and dates", () => {
  assert.throws(() => payload({ ...base, type: "text", text: "" }), /Enter text/);
  assert.throws(() => payload({ ...base, type: "sms", phone: "\nTEL:evil" }), /SMS phone/);
  assert.throws(() => payload({ ...base, type: "phone", phone: "abc1def" }), /valid phone/);
  assert.throws(() => payload({ ...base, type: "sms", phone: "+1@example.com" }), /valid SMS/);
  assert.throws(() => payload({ ...base, type: "whatsapp", phone: "abc123456def" }), /WhatsApp phone/);
  assert.throws(() => payload({ ...base, type: "location", latitude: "91", longitude: "0" }), /Latitude/);
  assert.throws(() => payload({ ...base, type: "location", latitude: "0", longitude: "-181" }), /Longitude/);
  assert.throws(() => payload({ ...base, type: "event", eventTitle: "Test", eventStart: "2026-10-02T20:00", eventEnd: "2026-10-02T18:00" }), /after event start/);
  assert.throws(() => payload({ ...base, type: "event", eventTitle: "Test", eventStart: "2026-10-02T18:00", eventEnd: "2026-10-02T20:00", eventTimezone: "UTC\r\nATTENDEE:evil" }), /control characters/);
  assert.throws(() => payload({ ...base, type: "vcard", name: "Ada", website: "javascript:alert(1)" }), /website address/);
});

test("maps structured catalog destinations while retaining URL families", () => {
  assert.equal(contentTypeForDestination("whatsapp"), "whatsapp");
  assert.equal(contentTypeForDestination("event"), "event");
  assert.equal(contentTypeForDestination("instagram"), "url");
});
