import { Directory, File, Paths } from "expo-file-system";
import { AESEncryptionKey, AESKeySize, AESSealedData, aesDecryptAsync, aesEncryptAsync, randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createLocalLibrary } from "./local-library-core";
import { FileEntry, LibraryAdapters, LIMITS, fail, validFileName, validId, uuidPattern } from "./local-library-model";

const KEY = "qrupgrade.local-library.key.v1";
const options: SecureStore.SecureStoreOptions = {
  keychainService: KEY,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};
const root = () => new Directory(Paths.document, "qrupgrade-library-v1");
const directory = (id: string) => { validId(id); return new Directory(root(), id); };
function file(id: string, name: string) {
  if (!validFileName(name)) fail("invalid", "Invalid owned filename.");
  return new File(directory(id), name);
}
export const nativeLibraryAdapters: LibraryAdapters = {
  now: () => new Date().toISOString(),
  crypto: {
    uuid: randomUUID,
    generateKey: async () => (await AESEncryptionKey.generate(AESKeySize.AES256)).encoded("hex"),
    encrypt: async (raw, plaintext, aad) => {
      const key = await AESEncryptionKey.import(raw, "hex");
      const sealed = await aesEncryptAsync(plaintext, key, { nonce: { length: 12 }, tagLength: 16, additionalData: aad });
      if (sealed.ivSize !== 12 || sealed.tagSize !== 16) fail("storage", "Unexpected encryption format.");
      return sealed.combined();
    },
    decrypt: async (raw, bytes, aad) => {
      const key = await AESEncryptionKey.import(raw, "hex");
      const sealed = AESSealedData.fromCombined(bytes, { ivLength: 12, tagLength: 16 });
      return aesDecryptAsync(sealed, key, { output: "bytes", additionalData: aad });
    },
  },
  keys: {
    get: () => SecureStore.getItemAsync(KEY, options),
    set: raw => SecureStore.setItemAsync(KEY, raw, options),
    remove: () => SecureStore.deleteItemAsync(KEY, options),
  },
  files: {
    inventory: async () => {
      const base = root();
      // exists=false also means inaccessible in Expo. Enumerate the parent so an
      // access error can never be mistaken for an empty library/key rotation.
      const found = Paths.document.list().find(entry => entry.name === "qrupgrade-library-v1");
      if (!found) return { entries: [], totalBytes: 0, unknownEntries: false };
      if (!(found instanceof Directory)) return { entries: [], totalBytes: found.size, unknownEntries: true };
      const totalBytes = base.size;
      if (totalBytes === null || !Number.isSafeInteger(totalBytes)) fail("storage", "The library size could not be read.");
      const entries: FileEntry[] = [];
      let unknownEntries = false, count = 0;
      for (const child of base.list()) {
        if (++count > LIMITS.inventoryEntries) fail("quota", "Too many library files to scan safely.");
        if (!(child instanceof Directory) || !uuidPattern.test(child.name)) { unknownEntries = true; continue; }
        for (const entry of child.list()) {
          if (++count > LIMITS.inventoryEntries) fail("quota", "Too many library files to scan safely.");
          if (!(entry instanceof File)) { unknownEntries = true; entries.push({ id: child.name, name: "unrecognized-directory", size: 0 }); continue; }
          entries.push({ id: child.name, name: entry.name, size: entry.size });
        }
      }
      return { entries, totalBytes, unknownEntries };
    },
    read: async (id, name) => {
      const selected = file(id, name);
      if (!selected.exists || selected.size > LIMITS.recordBytes || selected.size < 80) fail("damaged", "Saved file is missing or has an invalid size.");
      return selected.bytes();
    },
    writeNew: async (id, name, bytes) => {
      root().create({ intermediates: true, idempotent: true });
      directory(id).create({ idempotent: true });
      const target = file(id, name);
      target.create({ overwrite: false });
      target.write(bytes);
    },
    moveNew: async (id, from, to) => {
      const target = file(id, to);
      if (target.exists) fail("conflict", "The saved generation already exists.");
      await file(id, from).move(target, { overwrite: false });
    },
    remove: async (id, name) => { const target = file(id, name); if (target.exists) target.delete(); },
    removeEmpty: async id => {
      const target = directory(id);
      if (target.exists) { if (target.list().length) fail("cleanup", "Saved files still remain."); target.delete(); }
    },
    reset: async () => {
      // The owned root can be a malformed regular file. Delete the actual entry
      // returned by its parent rather than relying on Directory.exists.
      const target = Paths.document.list().find(entry => entry.name === "qrupgrade-library-v1");
      if (target) target.delete();
      if (Paths.document.list().some(entry => entry.name === "qrupgrade-library-v1")) fail("cleanup", "Local saved files could not be removed.");
    },
    freeBytes: async () => Paths.availableDiskSpace,
  },
};
export const localLibrary = createLocalLibrary(nativeLibraryAdapters);
export const localLibrarySupported = true;
export type { Library, LibraryListing, LibraryRow, SaveInput } from "./local-library-core";
export { LibraryError } from "./local-library-model";
