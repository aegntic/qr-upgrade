import { fromByteArray, toByteArray } from "base64-js";
import { AssetRole, DraftSnapshot, boundedString, object, snapshotDraft } from "./draft-model";

export const LIMITS = Object.freeze({ designs: 20, libraryBytes: 100 * 1024 ** 2, metadataBytes: 64 * 1024, assetBytes: 3 * 1024 ** 2, recordBytes: 5 * 1024 ** 2, inputImageBytes: 8 * 1024 ** 2, headroomBytes: 15 * 1024 ** 2, inventoryEntries: 512 });
export type LibraryErrorCode = "unsupported" | "invalid" | "unsupported-version" | "key-missing" | "key-unavailable" | "damaged" | "storage" | "cleanup" | "quota" | "disk-full" | "not-found" | "conflict";
export class LibraryError extends Error {
  constructor(public readonly code: LibraryErrorCode, message: string) { super(message); this.name = "LibraryError"; }
}
export function fail(code: LibraryErrorCode, message: string): never { throw new LibraryError(code, message); }
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validId(id: unknown): asserts id is string { if (typeof id !== "string" || !uuidPattern.test(id)) fail("invalid", "Invalid saved design identifier."); }
export function validGeneration(n: unknown): asserts n is number { if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) fail("invalid", "Invalid saved generation."); }
export function recordName(n: number) { validGeneration(n); return `${n}.qru`; }
export function parseName(name: string): number | null {
  if (!/^[1-9]\d{0,15}\.qru$/.test(name)) return null;
  const n = Number(name.slice(0, -4)); return Number.isSafeInteger(n) ? n : null;
}
export function validFileName(name: string) {
  return parseName(name) !== null || /^stage-[0-9a-f-]{36}\.tmp$/.test(name) && uuidPattern.test(name.slice(6, -4));
}
export function validateTitle(value: unknown) {
  const title = boundedString(value, 80, "title").trim();
  if (!title || /[\u0000-\u001f\u007f]/.test(title)) fail("invalid", "Enter a title from 1 to 80 characters.");
  return title;
}
export type SavedAsset = { mime: "image/png" | "image/jpeg"; width: number; height: number; byteCount: number; data: string };
export type Assets = Partial<Record<AssetRole, SavedAsset>>;
export type Header = { schemaVersion: 1; id: string; generation: number };
type RecordBase = Header & { createdAt: string; updatedAt: string };
export type DesignRecord = RecordBase & { kind: "design"; title: string; draft: DraftSnapshot; assets: Assets };
export type DeletedRecord = RecordBase & { kind: "deleted" };
export type LibraryRecord = DesignRecord | DeletedRecord;
export type FileEntry = { id: string; name: string; size: number };
export interface LibraryFiles {
  inventory(): Promise<{ entries: FileEntry[]; totalBytes: number; unknownEntries: boolean }>;
  read(id: string, name: string): Promise<Uint8Array>;
  writeNew(id: string, name: string, bytes: Uint8Array): Promise<void>;
  moveNew(id: string, from: string, to: string): Promise<void>;
  remove(id: string, name: string): Promise<void>;
  removeEmpty(id: string): Promise<void>;
  reset(): Promise<void>; // Removes only the fixed owned root; verifies absence.
  freeBytes(): Promise<number>;
}
export interface LibraryCrypto {
  uuid(): string;
  generateKey(): Promise<string>;
  encrypt(key: string, plaintext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  decrypt(key: string, sealed: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
}
export interface LibraryKeys { get(): Promise<string | null>; set(key: string): Promise<void>; remove(): Promise<void> }
export type LibraryAdapters = { files: LibraryFiles; crypto: LibraryCrypto; keys: LibraryKeys; now(): string };
export const utf8 = (s: string) => new TextEncoder().encode(s);
export function headerBytes(header: Header): Uint8Array {
  validId(header.id); validGeneration(header.generation);
  return utf8(`QRUL1|1|${header.id}|${header.generation}\n`);
}
export function frame(header: Header, sealed: Uint8Array) {
  const aad = headerBytes(header), bytes = new Uint8Array(aad.length + sealed.length);
  bytes.set(aad); bytes.set(sealed, aad.length);
  if (bytes.length > LIMITS.recordBytes) fail("quota", "This saved design exceeds 5 MiB.");
  return bytes;
}
export function unframe(bytes: Uint8Array): { header: Header; aad: Uint8Array; sealed: Uint8Array } {
  if (bytes.length > LIMITS.recordBytes || bytes.length < 80) fail("damaged", "Invalid saved file size.");
  const end = bytes.subarray(0, 100).indexOf(10);
  if (end < 0) fail("damaged", "Invalid saved file framing.");
  const line = new TextDecoder().decode(bytes.subarray(0, end));
  const match = /^QRUL1\|(\d+)\|([0-9a-f-]+)\|([1-9]\d*)$/.exec(line);
  if (!match) fail("damaged", "Unrecognized saved file framing.");
  if (match[1] !== "1") fail("unsupported-version", "This save needs a newer app version.");
  const header: Header = { schemaVersion: 1, id: match[2], generation: Number(match[3]) };
  validId(header.id); validGeneration(header.generation);
  const aad = headerBytes(header);
  if (aad.length !== end + 1 || bytes.length - aad.length < 28) fail("damaged", "Invalid saved file framing.");
  return { header, aad, sealed: bytes.subarray(end + 1) };
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail("invalid", "Unsupported saved fields.");
}
function canonical(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Read dimensions before any pixel decoding to bound allocation. */
export function imageDimensions(bytes: Uint8Array, mime: SavedAsset["mime"]) {
  if (mime === "image/png") {
    if (bytes.length < 33 || bytes.slice(0, 8).join(",") !== "137,80,78,71,13,10,26,10" || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") fail("invalid", "Invalid PNG image.");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) fail("invalid", "Invalid JPEG image.");
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) break;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([192, 193, 194].includes(marker) && length >= 8) return { height: bytes[offset + 3] * 256 + bytes[offset + 4], width: bytes[offset + 5] * 256 + bytes[offset + 6] };
    offset += length;
  }
  return fail("invalid", "Unsupported JPEG image.");
}
// Do not feed persisted compressed chunks into a JS inflater: malicious deflate
// streams can expand beyond IHDR dimensions. Native normalization and reopen
// perform full decoding; this platform-free boundary checks bounded framing.
function validatePngStructure(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) fail("invalid", "Unsupported PNG pixels.");
  let offset = 8, imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (length > bytes.length - offset - 12 || type === "acTL" || offset !== 8 && type === "IHDR") fail("invalid", "Invalid PNG chunks.");
    if (type === "IDAT") imageData = true;
    offset += length + 12;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length || !imageData) fail("invalid", "Invalid PNG ending.");
      return;
    }
  }
  fail("invalid", "Incomplete PNG image.");
}
export function validateAssets(value: unknown, draft: DraftSnapshot): Assets {
  const assets = object(value), result: Assets = {};
  const roles: AssetRole[] = ["artwork", "portrait", "scene"];
  if (Object.keys(assets).some(k => !roles.includes(k as AssetRole))) fail("invalid", "Invalid image role.");
  let total = 0;
  // Validate declared totals and base64 lengths BEFORE expanding any image bytes.
  for (const role of roles) {
    const expected = role === "scene" ? draft.photo : role === "artwork" ? draft.artworkUri : draft.portraitUri;
    if (!!expected !== Object.hasOwn(assets, role)) fail("invalid", "A saved image is missing or unreferenced.");
    if (!expected) continue;
    const a = object(assets[role]); exactKeys(a, ["mime", "width", "height", "byteCount", "data"]);
    if (!Number.isSafeInteger(a.byteCount) || (a.byteCount as number) < 1) fail("invalid", "Invalid image size.");
    total += a.byteCount as number;
    if (total > LIMITS.assetBytes || typeof a.data !== "string" || a.data.length !== 4 * Math.ceil((a.byteCount as number) / 3)) fail("quota", "Saved images exceed 3 MiB or have invalid sizes.");
    if (!Number.isInteger(a.width) || !Number.isInteger(a.height) || (a.width as number) < 1 || (a.height as number) < 1 || (a.width as number) > 1024 || (a.height as number) > 1024) fail("invalid", "Invalid saved image dimensions.");
    const size = role === "artwork" ? 512 : 256;
    if (role !== "scene" && (a.mime !== "image/png" || a.width !== size || a.height !== size) || role === "scene" && a.mime !== "image/jpeg") fail("invalid", "Invalid saved image format.");
  }
  for (const role of roles) {
    if (!Object.hasOwn(assets, role)) continue;
    const a = assets[role] as SavedAsset;
    if (/[^A-Za-z0-9+/=]/.test(a.data) || a.data.indexOf("=") !== -1 && !/^[A-Za-z0-9+/]*={1,2}$/.test(a.data)) fail("invalid", "Invalid image encoding.");
    const bytes = toByteArray(a.data);
    if (bytes.length !== a.byteCount || fromByteArray(bytes) !== a.data) fail("invalid", "Invalid image byte count.");
    const dimensions = imageDimensions(bytes, a.mime);
    if (dimensions.width !== a.width || dimensions.height !== a.height) fail("invalid", "Image dimensions do not match.");
    if (a.mime === "image/png") validatePngStructure(bytes);
    result[role] = { ...a };
  }
  return result;
}
export function validateRecord(value: unknown): LibraryRecord {
  const r = object(value);
  if (r.schemaVersion !== 1) fail("unsupported-version", "This save needs a newer app version.");
  validId(r.id); validGeneration(r.generation);
  if (r.kind !== "design" && r.kind !== "deleted") fail("invalid", "Invalid saved record kind.");
  exactKeys(r, ["schemaVersion", "kind", "id", "generation", "createdAt", "updatedAt", ...(r.kind === "design" ? ["title", "draft", "assets"] : [])]);
  for (const date of [r.createdAt, r.updatedAt]) if (typeof date !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date) fail("invalid", "Invalid saved date.");
  if ((r.updatedAt as string) < (r.createdAt as string)) fail("invalid", "Invalid saved date order.");
  const base: DeletedRecord = { schemaVersion: 1, kind: "deleted", id: r.id, generation: r.generation, createdAt: r.createdAt as string, updatedAt: r.updatedAt as string };
  if (r.kind === "deleted") return base;
  const draft = snapshotDraft(r.draft);
  if (canonical(draft) !== canonical(r.draft)) fail("invalid", "Unsupported draft fields or image references.");
  const metadata = { ...r, assets: Object.fromEntries(Object.entries(object(r.assets)).map(([role, a]) => [role, { ...object(a), data: "" }])) };
  if (utf8(JSON.stringify(metadata)).length > LIMITS.metadataBytes) fail("quota", "Saved metadata exceeds 64 KiB.");
  return { ...base, kind: "design", title: validateTitle(r.title), draft, assets: validateAssets(r.assets, draft) };
}
