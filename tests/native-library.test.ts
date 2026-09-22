import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as libraryModel from "../mobile/src/local-library-model";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { encode } from "../mobile/node_modules/fast-png/lib/index.js";
import { payload, Content } from "../shared/qr";
import { autoFix } from "../shared/score";
import { Draft, initialDraft, snapshotDraft } from "../mobile/src/draft-model";
import { createLocalLibrary, type Library } from "../mobile/src/local-library-core";
import { Assets, LibraryAdapters, LibraryError, LIMITS, frame, headerBytes, unframe, utf8, validateRecord } from "../mobile/src/local-library-model";

const clone = <T>(v: T): T => structuredClone(v);
const draft = (content: Partial<Content> = {}): Draft => ({ ...clone(initialDraft), content: { ...clone(initialDraft.content), ...content } });
function harness() {
  const files = new Map<string, Uint8Array>();
  let key: string | null = null, free = 200 * 1024 ** 2, extraBytes = 0, keyUnavailable = false;
  const faults = new Map<string, number>();
  const calls: string[] = [];
  function fault(name: string) { calls.push(name); const n = faults.get(name) || 0; if (n) { faults.set(name, n - 1); throw new Error(`Injected ${name}`); } }
  const a: LibraryAdapters = {
    now: () => "2026-09-21T01:00:00.000Z",
    keys: { get: async () => { if (keyUnavailable) throw new Error("locked"); return key; }, set: async value => { fault("key-set"); key = value; }, remove: async () => { fault("key-remove"); key = null; } },
    crypto: {
      uuid: randomUUID, generateKey: async () => randomBytes(32).toString("hex"),
      encrypt: async (raw, plain, aad) => { const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(raw, "hex"), nonce); cipher.setAAD(aad); return Buffer.concat([nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag()]); },
      decrypt: async (raw, sealed, aad) => { const decipher = createDecipheriv("aes-256-gcm", Buffer.from(raw, "hex"), sealed.subarray(0, 12)); decipher.setAAD(aad); decipher.setAuthTag(sealed.subarray(-16)); return Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]); },
    },
    files: {
      inventory: async () => ({ entries: [...files].map(([path, data]) => ({ id: path.split("/")[0], name: path.split("/")[1], size: data.length })), totalBytes: extraBytes + [...files.values()].reduce((n, b) => n + b.length, 0), unknownEntries: [...files.keys()].some(p => p.split("/").length !== 2) }),
      read: async (id, name) => { fault(name.startsWith("stage") ? "read-stage" : "read-final"); const bytes = files.get(`${id}/${name}`); if (!bytes) throw new Error("missing"); return Uint8Array.from(bytes); },
      writeNew: async (id, name, bytes) => { fault("write"); const path = `${id}/${name}`; assert(!files.has(path)); files.set(path, Uint8Array.from(bytes)); fault("write-after"); },
      moveNew: async (id, from, to) => { fault("move"); const source = `${id}/${from}`, target = `${id}/${to}`; assert(!files.has(target)); const bytes = files.get(source)!; files.set(target, bytes); files.delete(source); fault("move-after"); },
      remove: async (id, name) => { fault("remove"); files.delete(`${id}/${name}`); },
      removeEmpty: async () => { fault("remove-directory"); },
      reset: async () => { fault("reset"); files.clear(); extraBytes = 0; },
      freeBytes: async () => free,
    },
  };
  return { a, files, calls, faults, library: createLocalLibrary(a), setKey: (v: string | null) => { key = v; }, getKey: () => key, lock: () => { keyUnavailable = true; }, unlock: () => { keyUnavailable = false; }, setFree: (v: number) => { free = v; }, setExtra: (v: number) => { extraBytes = v; } };
}
const errorCode = (code: string) => (error: unknown) => error instanceof LibraryError && error.code === code;
const contentCases: Partial<Content>[] = [
  { type: "url", url: "https://qrupgrade.com/" }, { type: "text", text: "Hello 🌿" },
  { type: "phone", phone: "+61 400 123 456" }, { type: "sms", phone: "+61400123456", smsMessage: "Hello" },
  { type: "email", email: "hello@example.com", emailSubject: "Hi", emailBody: "Line one and line two" },
  { type: "whatsapp", phone: "+61400123456", whatsappMessage: "Hello" }, { type: "location", latitude: "-90", longitude: "180" },
  { type: "event", eventTitle: "Launch", eventStart: "2026-10-01T10:00", eventEnd: "2026-10-01T11:00", eventTimezone: "Australia/Sydney", eventLocation: "Sydney", eventDescription: "A launch" },
  { type: "wifi", ssid: " Office;WiFi ", password: " p;a:ss ", wifiEncryption: "WPA", wifiHidden: true },
  { type: "vcard", name: "Ada", email: "ada@example.com", phone: "+61400123456", company: "Team", title: "Maker", website: "https://example.com", address: "Sydney" },
];
for (const content of contentCases) test(`encrypted roundtrip: ${content.type}`, async () => {
  const h = harness(), input = draft(content), saved = await h.library.save({ title: "Example", draft: input });
  const reopened = await h.library.open(saved.id);
  assert.equal(payload(reopened.draft.content), payload(input.content));
  assert.deepEqual(reopened.draft, snapshotDraft(input));
  assert(!Buffer.from([...h.files.values()][0]).toString().includes("Example"));
  assert.deepEqual((await h.library.list()).rows, [{ id: saved.id, status: "saved", generation: 1, title: "Example", type: content.type, updatedAt: h.a.now() }]);
});
test("non-active credentials and verification never reach encrypted plaintext", async () => {
  for (const content of contentCases.filter(c => c.type !== "wifi")) {
    const h = harness(), input = { ...draft({ ...content, ssid: "SECRET-NETWORK", password: "SECRET-PASSWORD" }), verification: { ok: true }, ready: true, epoch: 2, generated: { png: "SECRET-PNG" } };
    const saved = await h.library.save({ title: "Clean", draft: input });
    const framed = unframe([...h.files.values()][0]);
    const plain = Buffer.from(await h.a.crypto.decrypt(h.getKey()!, framed.sealed, framed.aad)).toString();
    assert(!/SECRET|verification|ready|epoch|generated/.test(plain));
    assert.equal(saved.draft.content.password, "");
  }
  assert.equal(snapshotDraft(draft({ type: "wifi", ssid: "Open", password: "secret", wifiEncryption: "nopass" })).content.password, "");
});
test("snapshot capture cannot be changed by edits while save waits", async () => {
  const h = harness(), input = draft();
  const pending = h.library.save({ title: "Captured", draft: input });
  input.brand = "later"; input.content.url = "https://later.example";
  const saved = await pending;
  assert.equal(saved.draft.brand, initialDraft.brand); assert.equal(saved.draft.content.url, initialDraft.content.url);
});
test("unknown schemas, framing, path identities and excess ciphertext rejected", async () => {
  const h = harness(), saved = await h.library.save({ title: "Test", draft: draft() });
  for (const value of [new Uint8Array(LIMITS.recordBytes + 1), utf8("malicious framing"), utf8(`QRUL1|2|${saved.id}|1\n${"a".repeat(100)}`)]) assert.throws(() => unframe(value));
  await assert.rejects(h.library.open("../../outside"), errorCode("invalid"));
  assert.throws(() => validateRecord({ ...saved, schemaVersion: 2 }), errorCode("unsupported-version"));
  assert.throws(() => validateRecord({ ...saved, verification: { ok: true } }));
  assert.throws(() => validateRecord({ ...saved, draft: { ...saved.draft, photo: "file:///outside" } }));
  const [path, bytes] = [...h.files][0]; const replacement = bytes.slice(); replacement[replacement.length - 1] ^= 1; h.files.set(path, replacement);
  await assert.rejects(h.library.open(saved.id), errorCode("damaged"));
  assert.equal((await h.library.list()).rows[0].status, "damaged");
});
test("header AAD and decrypted identities are authenticated", async () => {
  const h = harness(), saved = await h.library.save({ title: "Test", draft: draft() }), [path, bytes] = [...h.files][0];
  const parsed = unframe(bytes), newId = randomUUID();
  h.files.delete(path); h.files.set(`${newId}/1.qru`, frame({ ...parsed.header, id: newId }, parsed.sealed));
  await assert.rejects(h.library.open(newId), errorCode("damaged"));
  const malformed = { ...saved, id: newId };
  const sealed = await h.a.crypto.encrypt(h.getKey()!, utf8(JSON.stringify(malformed)), headerBytes(saved));
  h.files.clear(); h.files.set(`${saved.id}/1.qru`, frame(saved, sealed));
  await assert.rejects(h.library.open(saved.id), errorCode("damaged"));
});
test("key loss, malformed key and temporary unavailability never replace existing keys", async () => {
  for (const missing of [null, "malformed"]) {
    const h = harness(); await h.library.save({ title: "Old", draft: draft() }); const oldBytes = clone([...h.files]); h.setKey(missing);
    await assert.rejects(h.library.save({ title: "New", draft: draft() }), errorCode("key-missing"));
    assert.equal(h.getKey(), missing); assert.deepEqual([...h.files], oldBytes);
  }
  const h = harness(); await h.library.save({ title: "Old", draft: draft() }); const originalKey = h.getKey(); h.lock();
  await assert.rejects(h.library.list(), errorCode("key-unavailable")); assert.equal(h.getKey(), originalKey);
  h.unlock(); assert.equal((await h.library.list()).rows.length, 1);
});
test("first key must persist and read back before writing", async () => {
  const h = harness(); h.faults.set("key-set", 1);
  await assert.rejects(h.library.save({ title: "No save", draft: draft() }), errorCode("key-unavailable"));
  assert.equal(h.files.size, 0);
  h.a.keys.get = async () => null;
  await assert.rejects(h.library.save({ title: "No save", draft: draft() }), errorCode("key-unavailable")); assert.equal(h.files.size, 0);
});
for (const fault of ["write", "write-after", "read-stage", "move"]) test(`${fault} failure leaves old saved bytes and input intact`, async () => {
  const h = harness(), input = draft(), saved = await h.library.save({ title: "Old", draft: input }), old = clone([...h.files]), original = clone(input);
  h.faults.set(fault, 1);
  await assert.rejects(h.library.save({ title: "New", draft: input, id: saved.id, expectedGeneration: 1 }));
  assert.deepEqual([...h.files], old); assert.deepEqual(input, original);
  assert.equal((await h.library.open(saved.id)).title, "Old");
});
test("move completion ambiguity is resolved by authenticated final readback", async () => {
  const h = harness(), saved = await h.library.save({ title: "Old", draft: draft() });
  h.faults.set("move-after", 1);
  const next = await h.library.rename(saved.id, "New", 1); assert.equal(next.generation, 2); assert.equal(h.files.size, 2);
});
test("final readback transient failure is resolved without deleting a successful save", async () => {
  const h = harness(); h.faults.set("read-final", 1);
  const saved = await h.library.save({ title: "Present", draft: draft() }); assert.equal((await h.library.open(saved.id)).title, "Present");
});
test("repeated final readback failure preserves both immutable generations", async () => {
  const h = harness(), saved = await h.library.save({ title: "Old", draft: draft() }), old = clone(h.files.get(`${saved.id}/1.qru`));
  const read = h.a.files.read;
  h.a.files.read = async (id, name) => { if (name === "2.qru") throw new Error("unavailable"); return read(id, name); };
  await assert.rejects(h.library.rename(saved.id, "New", 1), errorCode("storage"));
  assert.deepEqual(h.files.get(`${saved.id}/1.qru`), old); assert(h.files.has(`${saved.id}/2.qru`));
  h.a.files.read = read; assert.equal((await h.library.open(saved.id)).title, "New");
});
test("damaged highest generation is visible and prior recovery must be explicit", async () => {
  const h = harness(), first = await h.library.save({ title: "Previous", draft: draft() }); await h.library.rename(first.id, "Latest", 1);
  const latest = h.files.get(`${first.id}/2.qru`)!; latest[latest.length - 1] ^= 1;
  const listing = await createLocalLibrary(h.a).list(); const row = listing.rows[0];
  assert.equal(row.status, "damaged"); assert.equal("recovery" in row && row.recovery?.generation, 1);
  await assert.rejects(h.library.open(first.id), errorCode("damaged"));
  assert.equal((await h.library.open(first.id, { recoverPrevious: true })).title, "Previous"); assert.equal(h.files.size, 2);
});
test("cold validation cleans prior generations; failed cleanup remains visible", async () => {
  const h = harness(), first = await h.library.save({ title: "Previous", draft: draft() }); await h.library.rename(first.id, "Latest", 1); h.faults.set("remove", 1);
  const restarted = createLocalLibrary(h.a);
  const listing = await restarted.list(); assert.equal(listing.rows[0].status, "saved"); assert(listing.issues.length); assert.equal(h.files.size, 2);
  const retried = await restarted.list(); assert.deepEqual(retried.issues, []); assert.equal(h.files.size, 1); assert(h.files.has(`${first.id}/2.qru`));
});
test("Save/Delete operations are serialized and never resurrect a design", async () => {
  const h = harness(), first = await h.library.save({ title: "First", draft: draft() });
  const rename = h.library.rename(first.id, "Second", 1), deletion = h.library.delete(first.id);
  await Promise.all([rename, deletion]); assert.equal(h.files.size, 0); assert.equal((await h.library.list()).rows.length, 0);
  const second = await h.library.save({ title: "Next", draft: draft() });
  const remove = h.library.delete(second.id), update = h.library.rename(second.id, "Cannot return", 1);
  await remove; await assert.rejects(update, errorCode("not-found")); assert.equal(h.files.size, 0);
});
test("tombstone survives interrupted cleanup, hides old design and resumes after restart", async () => {
  const h = harness(), saved = await h.library.save({ title: "Delete me", draft: draft() }); h.faults.set("remove", 2);
  await assert.rejects(h.library.delete(saved.id), errorCode("cleanup")); assert(h.files.has(`${saved.id}/2.qru`));
  const listing = await h.library.list(); assert.equal(listing.rows[0].status, "deleting");
  await assert.rejects(h.library.open(saved.id, { recoverPrevious: true }), errorCode("not-found"));
  const restarted = createLocalLibrary(h.a); assert.equal((await restarted.list()).rows.length, 0); assert.equal(h.files.size, 0);
});
test("failed tombstone write leaves original visible", async () => {
  const h = harness(), saved = await h.library.save({ title: "Keep me", draft: draft() }), old = clone([...h.files]); h.faults.set("write", 1);
  await assert.rejects(h.library.delete(saved.id)); assert.deepEqual([...h.files], old); assert.equal((await h.library.open(saved.id)).title, "Keep me");
});
test("reset removes files before key and retains key on failed cleanup", async () => {
  const h = harness(); await h.library.save({ title: "Keep", draft: draft() }); const key = h.getKey(); h.faults.set("reset", 1);
  await assert.rejects(h.library.reset()); assert.equal(h.getKey(), key); assert.equal(h.files.size, 1);
  await h.library.reset(); assert.equal(h.files.size, 0); assert.equal(h.getKey(), null);
});
test("20 designs, retained bytes and device headroom are hard bounds without eviction", async () => {
  const h = harness(); for (let n = 0; n < 20; n++) await h.library.save({ title: `Design ${n}`, draft: draft() });
  const before = clone([...h.files]); await assert.rejects(h.library.save({ title: "Over", draft: draft() }), errorCode("quota")); assert.deepEqual([...h.files], before);
  const space = harness(); space.setFree(LIMITS.headroomBytes); await assert.rejects(space.library.save({ title: "No space", draft: draft() }), errorCode("disk-full")); assert.equal(space.files.size, 0);
  const quota = harness(); await quota.library.save({ title: "Existing", draft: draft() }); quota.setExtra(LIMITS.libraryBytes);
  await assert.rejects(quota.library.save({ title: "Too many bytes", draft: draft() }), errorCode("quota")); assert.equal(quota.files.size, 1);
});
test("stable image bytes survive later edits and failed writes", async () => {
  const h = harness(), png = encode({ width: 256, height: 256, data: new Uint8Array(256 * 256 * 4).fill(255), channels: 4, depth: 8 });
  const assets: Assets = { portrait: { mime: "image/png", width: 256, height: 256, byteCount: png.length, data: Buffer.from(png).toString("base64") } };
  const input: Draft = { ...draft(), portraitUri: "file:///picker/original.png" };
  const saved = await h.library.save({ title: "Image", draft: input, assets }), stable = clone([...h.files]);
  assets.portrait!.data = "changed"; input.portraitUri = null;
  assert.equal((await h.library.open(saved.id)).assets.portrait?.data, saved.assets.portrait?.data);
  h.faults.set("write", 1); await assert.rejects(h.library.save({ title: "Failed", draft: input, id: saved.id, expectedGeneration: 1 })); assert.deepEqual([...h.files], stable);
  assert.throws(() => validateRecord({ ...saved, assets: { portrait: { ...saved.assets.portrait, byteCount: LIMITS.assetBytes + 1 } } }));
  assert.throws(() => validateRecord({ ...saved, assets: { portrait: { ...saved.assets.portrait, width: 999999 } } }));
});
test("validated setting bounds include actual autoFix output", () => {
  const fixed = autoFix({ ...initialDraft.appearance, modules: 177, sizeMm: 10, distanceCm: 200 });
  assert.doesNotThrow(() => snapshotDraft({ ...draft(), sizeMm: fixed.sizeMm, appearance: { ...initialDraft.appearance, ...fixed } }));
  assert.throws(() => snapshotDraft({ ...draft(), sizeMm: 2001 })); assert.throws(() => snapshotDraft({ ...draft(), rotation: Infinity }));
  assert.throws(() => snapshotDraft(draft({ type: "text", text: "🌿".repeat(400) })));
});
test("unknown records stay untouched while other rows remain usable", async () => {
  const h = harness(), good = await h.library.save({ title: "Good", draft: draft() }), other = randomUUID();
  h.files.set(`${other}/1.qru`, utf8(`QRUL1|2|${other}|1\n${"a".repeat(100)}`));
  const listing = await h.library.list(); assert(listing.rows.some(r => r.status === "unsupported")); assert.equal(listing.recovery, undefined); assert.equal((await h.library.open(good.id)).title, "Good"); assert(h.files.has(`${other}/1.qru`));
});
test("interrupted staging cleanup retries after restart and is counted against quota", async () => {
  const h = harness(); await h.library.save({ title: "Present", draft: draft() }); const id = [...h.files.keys()][0].split("/")[0];
  const stage = `${id}/stage-${randomUUID()}.tmp`; h.files.set(stage, new Uint8Array(99)); h.faults.set("remove", 2);
  const listing = await createLocalLibrary(h.a).list(); assert(listing.issues.length); assert(h.files.has(stage));
  await createLocalLibrary(h.a).list(); assert(!h.files.has(stage));
});
test("web adapter is explicitly unsupported with no storage fallback", async () => {
  const { localLibrary, localLibrarySupported } = await import("../mobile/src/local-library.web"); assert.equal(localLibrarySupported, false);
  await assert.rejects(localLibrary.list(), errorCode("unsupported")); await assert.rejects(localLibrary.save({ title: "Web", draft: draft() }), errorCode("unsupported"));
});
test("fresh encryption nonce on each immutable generation", async () => {
  const h = harness(), saved = await h.library.save({ title: "One", draft: draft() }); await h.library.rename(saved.id, "Two", 1);
  const nonces = [...h.files.values()].map(v => unframe(v).sealed.slice(0, 12)); assert.notDeepEqual(nonces[0], nonces[1]);
});
test("oversized file is rejected before read/decrypt and valid rows remain readable", async () => {
  const h = harness(), saved = await h.library.save({ title: "Good", draft: draft() }), oversizedId = randomUUID();
  h.files.set(`${oversizedId}/1.qru`, new Uint8Array(LIMITS.recordBytes + 1)); h.calls.length = 0;
  await assert.rejects(h.library.open(oversizedId), errorCode("damaged")); assert(!h.calls.includes("read-final"));
  assert.equal((await h.library.open(saved.id)).title, "Good");
});
test("a new save cannot overwrite a stale generation", async () => {
  const h = harness(), first = await h.library.save({ title: "One", draft: draft() }); await h.library.rename(first.id, "Two", 1);
  const before = clone([...h.files]); await assert.rejects(h.library.save({ id: first.id, expectedGeneration: 1, title: "Stale", draft: draft() }), errorCode("conflict")); assert.deepEqual([...h.files], before);
});
test("authentication failure after move removes only the newly created artifact", async () => {
  const h = harness(), first = await h.library.save({ title: "Old", draft: draft() }), before = clone([...h.files]);
  const move = h.a.files.moveNew; h.a.files.moveNew = async (id, from, to) => { await move(id, from, to); const bytes = h.files.get(`${id}/${to}`)!; bytes[bytes.length - 1] ^= 1; };
  await assert.rejects(h.library.rename(first.id, "Bad", 1), errorCode("damaged")); assert.deepEqual([...h.files], before);
});
test("a damaged or oversized declared image cannot be written", async () => {
  const h = harness(), invalidAssets = { portrait: { mime: "image/png" as const, width: 256, height: 256, byteCount: 10, data: "not a png!" } };
  await assert.rejects(h.library.save({ title: "Invalid image", draft: { ...draft(), portraitUri: "file:///cache/image.png" }, assets: invalidAssets })); assert.equal(h.files.size, 0);
});
test("a failed save cleanup remains visible and retries without changing saved bytes", async () => {
  const h = harness(), first = await h.library.save({ title: "Old", draft: draft() }), old = clone(h.files.get(`${first.id}/1.qru`));
  h.faults.set("write-after", 1); h.faults.set("remove", 2);
  await assert.rejects(h.library.rename(first.id, "Uncommitted", 1), errorCode("cleanup"));
  const listing = await h.library.list(); assert(listing.issues.length); assert.deepEqual(h.files.get(`${first.id}/1.qru`), old);
  await h.library.list(); assert.equal(h.files.size, 1);
});
test("same-instance list keeps retrying older-generation cleanup until it succeeds", async () => {
  const h = harness(), first = await h.library.save({ title: "Previous", draft: draft() });
  await h.library.rename(first.id, "Latest", 1);
  const restarted = createLocalLibrary(h.a), bytes = clone([...h.files]);
  h.faults.set("remove", 3);
  for (let attempt = 0; attempt < 3; attempt++) {
    const listing = await restarted.list();
    assert.equal(listing.rows[0].status, "saved");
    assert.deepEqual(listing.issues, ["An older saved generation still needs cleanup."]);
    assert.deepEqual([...h.files], bytes);
    assert.equal(listing.totalBytes, bytes.reduce((total, [, file]) => total + file.length, 0));
  }
  const cleaned = await restarted.list();
  assert.deepEqual(cleaned.issues, []);
  assert.deepEqual([...h.files.keys()], [`${first.id}/2.qru`]);
  assert.equal(cleaned.totalBytes, h.files.get(`${first.id}/2.qru`)!.length);
});
test("a completed cleanup retry does not prune the next committed save's backup on list", async () => {
  const h = harness(), first = await h.library.save({ title: "One", draft: draft() });
  await h.library.rename(first.id, "Two", 1);
  const restarted = createLocalLibrary(h.a);
  h.faults.set("remove", 1); assert((await restarted.list()).issues.length);
  await restarted.rename(first.id, "Three", 2);
  assert.deepEqual((await restarted.list()).issues, []);
  assert.deepEqual([...h.files.keys()].sort(), [`${first.id}/2.qru`, `${first.id}/3.qru`]);
  await restarted.open(first.id);
  assert.deepEqual([...h.files.keys()], [`${first.id}/3.qru`]);
});

// Evaluate the real native adapter with SDK-shaped module doubles. This executes
// its reset implementation (not a parallel copy) without pretending to execute
// Expo's native filesystem/Keychain modules in Node.
const nativeAdapterCode = ts.transpileModule(
  readFileSync(new URL("../mobile/src/local-library.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
function nativeResetHarness(shape: "file" | "directory" | "absent", fault?: "delete" | "access" | "verify-access" | "no-op-delete") {
  let present = shape !== "absent", key: string | null = "a".repeat(64), lists = 0;
  const deleted: string[] = [], order: string[] = [];
  class File {
    name: string;
    size = 16;
    constructor(name = "qrupgrade-library-v1") { this.name = name; }
    delete() {
      if (fault === "delete") throw new Error("Deletion denied");
      deleted.push(this.name); order.push("delete-entry");
      if (fault !== "no-op-delete") present = false;
    }
  }
  class Directory extends File {
    // Reproduce Expo's distinction: Directory.exists is false for a file.
    get exists() { return present && shape === "directory"; }
    list() { return [new File("unrecognized-entry")]; }
  }
  const target = shape === "directory" ? new Directory() : new File();
  const other = new File("qrupgrade-library-v1-unrelated");
  const modules: Record<string, unknown> = {
    "expo-file-system": { File, Directory, Paths: { document: { list() {
      lists++; order.push("list-parent");
      if (fault === "access" || fault === "verify-access" && lists === 2) throw new Error("Parent inaccessible");
      return present ? [other, target] : [other];
    } } } },
    "expo-crypto": {},
    "expo-secure-store": { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1, getItemAsync: async () => key, deleteItemAsync: async () => { order.push("delete-key"); key = null; } },
    "./local-library-model": libraryModel,
    "./local-library-core": { createLocalLibrary },
  };
  const exports: { nativeLibraryAdapters?: LibraryAdapters } = {};
  runInNewContext(nativeAdapterCode, { exports, require: (name: string) => {
    assert(Object.hasOwn(modules, name), `Unexpected adapter dependency: ${name}`);
    return modules[name];
  } });
  assert(exports.nativeLibraryAdapters);
  return { adapters: exports.nativeLibraryAdapters, library: createLocalLibrary(exports.nativeLibraryAdapters), deleted, order, hasRoot: () => present, getKey: () => key, setKey: (value: string | null) => { key = value; } };
}
for (const shape of ["file", "directory", "absent"] as const) test(`native reset handles ${shape} at the fixed owned root`, async () => {
  const h = nativeResetHarness(shape);
  await h.library.reset();
  assert.equal(h.hasRoot(), false); assert.equal(h.getKey(), null);
  assert.deepEqual(h.deleted, shape === "absent" ? [] : ["qrupgrade-library-v1"]);
  assert.equal(h.order.at(-1), "delete-key");
  assert.equal(h.order.filter(call => call === "list-parent").length, 3);
});
for (const fault of ["delete", "access", "verify-access", "no-op-delete"] as const) test(`native reset retains the key after ${fault} failure`, async () => {
  const h = nativeResetHarness("file", fault);
  await assert.rejects(h.library.reset(), errorCode(fault === "no-op-delete" ? "cleanup" : "storage"));
  assert.equal(h.getKey(), "a".repeat(64)); assert(!h.order.includes("delete-key"));
  assert.equal(h.hasRoot(), fault !== "verify-access");
  assert(!h.deleted.includes("qrupgrade-library-v1-unrelated"));
});

// Execute the production component with hook/SDK-shaped doubles. This verifies
// the core-to-screen recovery composition, not an installed React Native runtime.
type ScreenNode = { type: string; props: { children?: unknown; title?: string; onPress?: () => void } };
type AlertButton = { text: string; style?: string; onPress?: () => void };
const libraryScreenCode = ts.transpileModule(
  readFileSync(new URL("../mobile/app/library.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
function libraryScreen(library: Library) {
  const state: unknown[] = [], refs: { current: unknown }[] = [];
  const alerts: { message: string; buttons: AlertButton[] }[] = [];
  let cursor = 0, refCursor = 0, focused = false, focus: (() => void) | undefined;
  const jsx = (type: string, props: ScreenNode["props"]) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const slot = cursor++;
        if (!(slot in state)) state[slot] = initial;
        return [state[slot], (value: unknown) => { state[slot] = value; }];
      },
      useRef(initial: unknown) { return refs[refCursor++] ||= { current: initial }; },
      useCallback: (callback: unknown) => callback,
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text", View: "View", Pressable: "Pressable", Platform: { OS: "android" },
      Alert: { alert: (_title: string, message: string, buttons: AlertButton[]) => alerts.push({ message, buttons }) },
    },
    "expo-router": { useRouter: () => ({}), useFocusEffect: (callback: () => void) => { focus = callback; } },
    "../src/local-library-model": libraryModel,
    "../src/draft": { useDraft: () => ({ localLibrarySupported: true, listSaved: () => library.list(), resetSavedLibrary: () => library.reset() }) },
    "../src/library-title-dialog": { LibraryTitleDialog: "LibraryTitleDialog" },
    "../src/library-screen-lifecycle": {},
    "../src/ui": { Button: "Button", Card: "Card", Copy: "Copy", Heading: "Heading", Page: "Page", useTheme: () => ({}) },
  };
  const exports: { default?: () => ScreenNode } = {};
  runInNewContext(libraryScreenCode, { exports, require: (name: string) => {
    assert(Object.hasOwn(modules, name), `Unexpected screen dependency: ${name}`);
    return modules[name];
  } });
  function render() {
    cursor = 0; refCursor = 0;
    const tree = exports.default!(), nodes: ScreenNode[] = [], text: string[] = [];
    function walk(value: unknown) {
      if (typeof value === "string") text.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object" && "props" in value) {
        const node = value as ScreenNode; nodes.push(node); walk(node.props.children);
      }
    }
    walk(tree);
    if (!focused) { focused = true; focus?.(); }
    return { text: text.join(" "), buttons: nodes.filter(node => node.type === "Button") };
  }
  return { render, alerts, settle: () => new Promise<void>(resolve => setImmediate(resolve)) };
}

for (const shape of ["file", "directory"] as const) test(`production library screen exposes confirmed recovery for unknown ${shape} inventory with an intact key`, async () => {
  const h = nativeResetHarness(shape), originalKey = h.getKey();
  const listing = await h.library.list();
  assert.equal(listing.recovery, "unrecognized-files");
  assert.equal(listing.rows.length, 0); assert.equal(listing.totalBytes, 16);
  await assert.rejects(h.library.save({ title: "Blocked", draft: draft() }), errorCode("unsupported-version"));
  const screen = libraryScreen(h.library);
  screen.render(); await screen.settle();
  const rendered = screen.render();
  assert(!rendered.text.includes("No saved designs yet"));
  const reset = rendered.buttons.find(node => node.props.title === "Delete inaccessible local saves");
  assert(reset); reset.props.onPress!();
  const confirmation = screen.alerts.at(-1)!;
  assert.match(confirmation.message, /unrecognized or inaccessible files/);
  assert.match(confirmation.message, /including readable designs/);
  assert(!confirmation.message.includes("key is"));
  confirmation.buttons.find(button => button.style === "cancel")?.onPress?.();
  await screen.settle();
  assert(h.hasRoot()); assert.equal(h.getKey(), originalKey); assert.deepEqual(h.deleted, []);
  reset.props.onPress!();
  screen.alerts.at(-1)!.buttons.find(button => button.style === "destructive")!.onPress!();
  await screen.settle();
  assert(!h.hasRoot()); assert.equal(h.getKey(), null);
  assert.deepEqual(h.deleted, ["qrupgrade-library-v1"]);
  assert.equal((await h.library.list()).recovery, undefined);
  assert(screen.render().text.includes("No saved designs yet"));
});

test("unrecognized inventory preserves bytes until explicit reset and then permits save/reopen", async () => {
  const h = harness(); h.setKey("a".repeat(64));
  h.files.set("unrecognized", new Uint8Array(16));
  const before = clone([...h.files]);
  assert.equal((await h.library.list()).recovery, "unrecognized-files");
  await assert.rejects(h.library.save({ title: "Blocked", draft: draft() }), errorCode("unsupported-version"));
  assert.deepEqual([...h.files], before); assert.equal(h.getKey(), "a".repeat(64));
  await h.library.reset();
  const saved = await h.library.save({ title: "Recovered", draft: draft() });
  assert.equal((await h.library.open(saved.id)).title, "Recovered");
  assert.equal((await h.library.list()).recovery, undefined);
});

test("production screen retains missing-key confirmation and reset cleanup retry", async () => {
  const h = nativeResetHarness("file"); h.setKey(null);
  const screen = libraryScreen(h.library);
  screen.render(); await screen.settle();
  const rendered = screen.render();
  assert(!rendered.text.includes("No saved designs yet"));
  rendered.buttons.find(node => node.props.title === "Delete inaccessible local saves")!.props.onPress!();
  assert.match(screen.alerts.at(-1)!.message, /key is missing or invalid/);
  assert(h.hasRoot()); assert.deepEqual(h.deleted, []);
  const removeKey = h.adapters.keys.remove;
  h.adapters.keys.remove = async () => { throw new Error("temporarily unavailable"); };
  screen.alerts.at(-1)!.buttons.find(button => button.style === "destructive")!.onPress!();
  await screen.settle();
  assert(!h.hasRoot());
  const retry = screen.render().buttons.find(node => node.props.title === "Retry local save cleanup");
  assert(retry); h.adapters.keys.remove = removeKey;
  retry.props.onPress!();
  screen.alerts.at(-1)!.buttons.find(button => button.style === "destructive")!.onPress!();
  await screen.settle();
  assert(screen.render().text.includes("No saved designs yet"));
});

test("newer-schema rows do not expose whole-library reset", async () => {
  const h = harness(); h.setKey("a".repeat(64));
  const id = randomUUID();
  h.files.set(`${id}/1.qru`, utf8(`QRUL1|2|${id}|1\n${"a".repeat(100)}`));
  const before = clone([...h.files]), screen = libraryScreen(h.library);
  screen.render(); await screen.settle();
  const rendered = screen.render();
  assert(rendered.text.includes("Newer app required"));
  assert(!rendered.buttons.some(node => node.props.title === "Delete inaccessible local saves"));
  assert.deepEqual([...h.files], before);
});
