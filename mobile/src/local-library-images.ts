import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { fromByteArray, toByteArray } from "base64-js";
import { AssetRole, Draft, snapshotDraft } from "./draft-model";
import { Assets, DesignRecord, LIMITS, SavedAsset, fail, validId, validateAssets, validateRecord } from "./local-library-model";

const workingRoot = () => new Directory(Paths.cache, "qrupgrade-working");
const normalizationRoot = () => new Directory(Paths.cache, "qrupgrade-normalizing");
const dimensions = (uri: string) => new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
function cacheFile(uri: string): File {
  // Only live private cache selections, never a persisted or remote URI. URI
  // canonicalization also blocks traversal and encoded separator tricks.
  if (!uri.startsWith("file://") || /[?#\\]/.test(uri)) fail("invalid", "Choose a local image again.");
  const canonical = new URL(uri);
  const path = decodeURIComponent(canonical.pathname);
  const cachePath = decodeURIComponent(new URL(Paths.cache.uri).pathname).replace(/\/$/, "") + "/";
  if (canonical.host || !path.startsWith(cachePath) || path.split("/").some(x => x === "." || x === "..") || /[\\\u0000]/.test(path)) fail("invalid", "Choose an image from this app's private cache.");
  return new File(canonical.href);
}
function removeDirectory(dir: Directory) { if (dir.exists) dir.delete(); }
/** Call once at cold startup BEFORE any working session/render is created. */
export async function purgeStaleLibraryImageCache() {
  removeDirectory(workingRoot()); removeDirectory(normalizationRoot());
}
/** Caller only receives an opaque owned session ID; picker originals are never removed. */
export async function releaseLibraryImageSession(sessionId: string) {
  validId(sessionId); removeDirectory(new Directory(workingRoot(), sessionId));
}
async function normalize(role: AssetRole, uri: string, session: Directory): Promise<SavedAsset> {
  const source = cacheFile(uri);
  if (!source.exists || !Number.isSafeInteger(source.size) || source.size < 1 || source.size > LIMITS.inputImageBytes) fail("invalid", "Choose an existing local image no larger than 8 MiB.");
  const dim = await dimensions(source.uri);
  if (!Number.isInteger(dim.width) || !Number.isInteger(dim.height) || dim.width < 1 || dim.height < 1 || dim.width * dim.height > 40_000_000) fail("invalid", "Choose an image below 40 megapixels.");
  const context = ImageManipulator.manipulate(source.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let temporary: File | undefined;
  try {
    if (role === "scene") {
      if (Math.max(dim.width, dim.height) > 1024) context.resize(dim.width >= dim.height ? { width: 1024 } : { height: 1024 });
    } else {
      const size = role === "artwork" ? 512 : 256, crop = Math.min(dim.width, dim.height);
      context.crop({ originX: (dim.width - crop) / 2, originY: (dim.height - crop) / 2, width: crop, height: crop });
      context.resize({ width: size, height: size });
    }
    rendered = await context.renderAsync();
    const output = await rendered.saveAsync({ format: role === "scene" ? SaveFormat.JPEG : SaveFormat.PNG, compress: role === "scene" ? 0.82 : 1 });
    temporary = cacheFile(output.uri);
    const owned = new File(session, `${role}.${role === "scene" ? "jpg" : "png"}`);
    await temporary.move(owned, { overwrite: false }); temporary = owned;
    if (owned.size < 1 || owned.size > LIMITS.assetBytes) fail("quota", "Saved images must fit within 3 MiB.");
    const bytes = await owned.bytes();
    if (bytes.length > LIMITS.assetBytes) fail("quota", "Saved images must fit within 3 MiB.");
    return { mime: role === "scene" ? "image/jpeg" : "image/png", width: output.width, height: output.height, byteCount: bytes.length, data: fromByteArray(bytes) };
  } finally {
    rendered?.release(); context.release();
    if (temporary?.exists) temporary.delete();
  }
}
/** Capture the draft at Save click; normalization does not patch the working draft. */
export async function captureLibraryAssets(draft: Draft): Promise<Assets> {
  const snapshot = snapshotDraft(draft);
  const sources: Partial<Record<AssetRole, string>> = {};
  if (snapshot.artworkUri && draft.artworkUri) sources.artwork = draft.artworkUri;
  if (snapshot.portraitUri && draft.portraitUri) sources.portrait = draft.portraitUri;
  if (snapshot.photo && draft.photo) sources.scene = draft.photo;
  const id = randomUUID(); validId(id);
  const session = new Directory(normalizationRoot(), id);
  session.create({ intermediates: true });
  try {
    const assets: Assets = {}; let total = 0;
    for (const role of ["artwork", "portrait", "scene"] as const) {
      const uri = sources[role]; if (!uri) continue;
      const asset = await normalize(role, uri, session);
      total += asset.byteCount;
      if (total > LIMITS.assetBytes) fail("quota", "The combined saved images exceed 3 MiB.");
      assets[role] = asset;
    }
    return validateAssets(assets, snapshot);
  } finally { removeDirectory(session); }
}
/** Build every file before returning. The UI must replace its draft only on success.
 * Release the old session only after pending render consumers have settled. */
export async function materializeLibraryDesign(value: DesignRecord): Promise<{ draft: Draft; sessionId: string }> {
  const record = validateRecord(value);
  if (record.kind !== "design") fail("invalid", "This design was deleted.");
  const id = randomUUID(); validId(id);
  const session = new Directory(workingRoot(), id);
  session.create({ intermediates: true });
  try {
    const uris: Partial<Record<AssetRole, string>> = {};
    for (const role of ["artwork", "portrait", "scene"] as const) {
      const asset = record.assets[role]; if (!asset) continue;
      const file = new File(session, `${role}.${asset.mime === "image/png" ? "png" : "jpg"}`);
      file.create({ overwrite: false }); file.write(toByteArray(asset.data));
      const dim = await dimensions(file.uri);
      if (dim.width !== asset.width || dim.height !== asset.height) fail("damaged", "A saved image could not be decoded.");
      // Force the native decoder through a full render (particularly for JPEG).
      const context = ImageManipulator.manipulate(file.uri);
      let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
      try { rendered = await context.renderAsync(); } finally { rendered?.release(); context.release(); }
      uris[role] = file.uri;
    }
    return { sessionId: id, draft: { ...record.draft, artworkUri: uris.artwork || null, portraitUri: uris.portrait || null, photo: uris.scene || null } };
  } catch (e) { removeDirectory(session); throw e; }
}
