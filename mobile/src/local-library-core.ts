import { Draft, snapshotDraft } from "./draft-model";
import { Assets, DesignRecord, FileEntry, LibraryAdapters, LibraryError, LibraryRecord, LIMITS, fail, frame, headerBytes, parseName, recordName, unframe, utf8, validFileName, validGeneration, validId, validateRecord, validateTitle } from "./local-library-model";

export type LibraryRow =
  | { id: string; status: "saved"; generation: number; title: string; type: Draft["content"]["type"]; updatedAt: string }
  | { id: string; status: "damaged" | "unsupported" | "deleting"; message: string; recovery?: { generation: number; updatedAt: string } };
export type LibraryListing = { rows: LibraryRow[]; issues: string[]; totalBytes: number; recovery?: "unrecognized-files" };
export type SaveInput = { title: string; draft: Draft; assets?: Assets; id?: string; expectedGeneration?: number };
export type Library = {
  list(): Promise<LibraryListing>;
  save(input: SaveInput): Promise<DesignRecord>;
  open(id: string, options?: { recoverPrevious?: boolean }): Promise<DesignRecord>;
  rename(id: string, title: string, expectedGeneration: number): Promise<DesignRecord>;
  delete(id: string): Promise<void>;
  reset(): Promise<void>;
};
const message = (e: unknown) => e instanceof LibraryError ? e.message : "Device storage could not be accessed. Try again.";

/** One queue includes reads: cleanup cannot race reopen or another mutation. */
export function createLocalLibrary(a: LibraryAdapters): Library {
  let tail: Promise<unknown> = Promise.resolve();
  let started = false;
  const pendingPrunes = new Map<string, number>();
  const queue = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work).catch(e => { throw e instanceof LibraryError ? e : new LibraryError("storage", "Device storage could not be accessed. Try again."); });
    tail = result.catch(() => {}); return result;
  };
  async function inventory() {
    const scan = await a.files.inventory();
    if (!Number.isSafeInteger(scan.totalBytes) || scan.totalBytes < 0 || scan.entries.length > LIMITS.inventoryEntries) fail("quota", "The saved library cannot be safely scanned. Delete inaccessible local saves to reset it.");
    for (const e of scan.entries) if (!Number.isSafeInteger(e.size) || e.size < 0) fail("storage", "A saved file size is unavailable.");
    return scan;
  }
  async function key(nonempty: boolean, create = false) {
    let raw: string | null;
    try { raw = await a.keys.get(); } catch { return fail("key-unavailable", "Private storage is unavailable. Unlock your device and try again."); }
    if (raw !== null && !/^[0-9a-f]{64}$/.test(raw)) {
      if (nonempty) fail("key-missing", "The key for your local saves is missing or invalid. Delete inaccessible local saves to reset.");
      raw = null;
    }
    if (!raw && nonempty) fail("key-missing", "The key for your local saves is missing. Delete inaccessible local saves to reset.");
    if (!raw && create) {
      raw = await a.crypto.generateKey();
      if (!/^[0-9a-f]{64}$/.test(raw)) fail("key-unavailable", "A private storage key could not be created.");
      try { await a.keys.set(raw); if (await a.keys.get() !== raw) throw new Error(); }
      catch { fail("key-unavailable", "The private storage key could not be verified. Try again."); }
    }
    return raw;
  }
  function group(entries: FileEntry[]) {
    const groups = new Map<string, FileEntry[]>();
    for (const e of entries) {
      try { validId(e.id); } catch { continue; }
      groups.set(e.id, [...(groups.get(e.id) || []), e]);
    }
    return groups;
  }
  function generations(entries: FileEntry[]) {
    if (entries.some(e => !validFileName(e.name))) fail("unsupported-version", "This design contains unrecognized files; it has been left untouched.");
    return entries.filter(e => parseName(e.name) !== null).sort((x, y) => parseName(y.name)! - parseName(x.name)!);
  }
  async function read(entry: FileEntry, raw: string): Promise<LibraryRecord> {
    validId(entry.id);
    if (!validFileName(entry.name) || entry.size > LIMITS.recordBytes || entry.size < 80) fail("damaged", "The saved file is damaged or exceeds 5 MiB.");
    const bytes = await a.files.read(entry.id, entry.name);
    if (bytes.length !== entry.size) fail("damaged", "The saved file changed while reading.");
    const { header, sealed, aad } = unframe(bytes);
    if (header.id !== entry.id || parseName(entry.name) !== null && header.generation !== parseName(entry.name)) fail("damaged", "Saved file identity does not match.");
    let plain: Uint8Array;
    try { plain = await a.crypto.decrypt(raw, sealed, aad); }
    catch { return fail("damaged", "This save could not be authenticated. Its data or key may be damaged."); }
    if (plain.length > LIMITS.recordBytes) fail("damaged", "Saved plaintext exceeds the size limit.");
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain)); }
    catch { return fail("damaged", "The saved design cannot be read."); }
    let record: LibraryRecord;
    try { record = validateRecord(value); }
    catch (e) { if (e instanceof LibraryError && e.code === "unsupported-version") throw e; return fail("damaged", "The saved design has invalid fields or images."); }
    if (record.id !== header.id || record.generation !== header.generation) fail("damaged", "Saved design identity does not match.");
    return record;
  }
  async function removeConfirmed(e: FileEntry) {
    await a.files.remove(e.id, e.name);
    if ((await inventory()).entries.some(x => x.id === e.id && x.name === e.name)) fail("cleanup", "Saved files still need cleanup. Try again.");
  }
  async function cleanupDeleted(record: LibraryRecord, entries: FileEntry[]) {
    // Never remove the tombstone until every older file is confirmed absent.
    generations(entries);
    for (const e of entries) if (e.name !== recordName(record.generation)) await removeConfirmed(e);
    const remaining = (await inventory()).entries.filter(e => e.id === record.id);
    if (remaining.some(e => e.name !== recordName(record.generation))) fail("cleanup", "Deletion is pending cleanup. Try again.");
    const tombstone = remaining.find(e => e.name === recordName(record.generation));
    if (tombstone) await removeConfirmed(tombstone);
    await a.files.removeEmpty(record.id);
    pendingPrunes.delete(record.id);
  }
  async function startup() {
    const scan = await inventory();
    const nonempty = scan.entries.length > 0 || scan.totalBytes > 0 || scan.unknownEntries;
    const raw = await key(nonempty);
    const issues: string[] = [];
    const cold = !started; started = true;
    if (raw) for (const e of scan.entries) {
      if (validFileName(e.name) && e.name.startsWith("stage-")) {
        try { validId(e.id); await removeConfirmed(e); } catch { issues.push("An interrupted save still needs temporary-file cleanup."); }
      }
    }
    return { scan: await inventory(), raw, issues, cold };
  }
  async function prune(entries: FileEntry[], current: FileEntry) {
    // Remember the authenticated generation eligible for cleanup. A retry must
    // not make a newly committed generation's backup eligible by accident.
    pendingPrunes.set(current.id, parseName(current.name)!);
    for (const e of entries) if (e.name !== current.name) await removeConfirmed(e);
    pendingPrunes.delete(current.id);
  }
  async function current(id: string, raw: string, recoverPrevious = false) {
    validId(id);
    const entries = (await inventory()).entries.filter(e => e.id === id);
    const sorted = generations(entries);
    if (!sorted.length) fail("not-found", "This saved design is no longer available.");
    if (recoverPrevious) {
      // Recovery is explicit and only the immediately previous generation is eligible.
      try { const top = await read(sorted[0], raw); if (top.kind === "deleted") fail("not-found", "This design was deleted."); }
      catch (e) { if (e instanceof LibraryError && ["not-found", "unsupported-version"].includes(e.code)) throw e; }
      if (!sorted[1]) fail("not-found", "No previous save is available.");
      const previous = await read(sorted[1], raw);
      if (previous.kind !== "design") fail("not-found", "No previous design is available.");
      return { record: previous, entries, sorted };
    }
    const record = await read(sorted[0], raw);
    if (record.kind === "deleted") {
      try { await cleanupDeleted(record, entries); } catch { fail("cleanup", "This design is deleted but its encrypted files still need cleanup."); }
      fail("not-found", "This design was deleted.");
    }
    return { record, entries, sorted };
  }
  async function commit(record: LibraryRecord, raw: string) {
    validateRecord(record);
    const bytes = frame(record, await a.crypto.encrypt(raw, utf8(JSON.stringify(record)), headerBytes(record)));
    const scan = await inventory();
    if (scan.totalBytes + bytes.length > LIMITS.libraryBytes) fail("quota", "Local saves exceed 100 MiB. Delete a saved design or retry cleanup first.");
    const free = await a.files.freeBytes();
    if (!Number.isFinite(free) || free < LIMITS.headroomBytes + bytes.length) fail("disk-full", "Free more device space before saving (at least 15 MiB plus this save).");
    const finalName = recordName(record.generation);
    if (scan.entries.some(e => e.id === record.id && e.name === finalName)) fail("conflict", "This saved version already exists. Reopen it before saving.");
    const token = a.crypto.uuid(); validId(token);
    const stage = `stage-${token}.tmp`;
    const staged = { id: record.id, name: stage, size: bytes.length };
    const final = { ...staged, name: finalName };
    let moving = false;
    try {
      await a.files.writeNew(record.id, stage, bytes);
      await read(staged, raw);
      moving = true;
      await a.files.moveNew(record.id, stage, finalName);
      await read(final, raw);
    } catch (error) {
      // Move/readback errors can arrive after the durable name exists. Re-authenticate
      // before deciding; never blindly remove a possibly committed generation.
      if (moving) {
        const exists = (await inventory()).entries.find(e => e.id === record.id && e.name === finalName);
        if (exists) {
          try {
            const found = await read(exists, raw);
            if (JSON.stringify(found) === JSON.stringify(record)) return;
            fail("damaged", "The new saved version does not match.");
          } catch (verifyError) {
            if (verifyError instanceof LibraryError && ["damaged", "invalid"].includes(verifyError.code)) {
              try { await removeConfirmed(exists); } catch { fail("cleanup", "The new save failed and its files need cleanup. The previous save remains available for recovery."); }
            } else fail("storage", "Save completion is uncertain. Reopen the library to check it; the previous generation is retained.");
          }
        }
      }
      try { await a.files.remove(record.id, stage); } catch { fail("cleanup", "Save failed and temporary files still need cleanup. Your previous save was retained."); }
      throw error;
    }
  }
  const library: Library = {
    list: () => queue(async () => {
      const { scan, raw, issues, cold } = await startup();
      if (scan.unknownEntries) issues.push("Unrecognized library files were left untouched; reset is available if they are inaccessible.");
      const rows: LibraryRow[] = [];
      if (raw) for (const [id, entries] of group(scan.entries)) {
        let sorted: FileEntry[] = [];
        try {
          sorted = generations(entries);
          if (!sorted.length) continue;
          const record = await read(sorted[0], raw);
          if (record.kind === "deleted") {
            try { await cleanupDeleted(record, entries); }
            catch { rows.push({ id, status: "deleting", message: "Deleted design still needs file cleanup. Retry deletion." }); }
            continue;
          }
          rows.push({ id, status: "saved", generation: record.generation, title: record.title, type: record.draft.content.type, updatedAt: record.updatedAt });
          if (cold || pendingPrunes.get(id) === record.generation) try { await prune(entries, sorted[0]); } catch { issues.push("An older saved generation still needs cleanup."); }
        } catch (e) {
          const row: LibraryRow = { id, status: e instanceof LibraryError && e.code === "unsupported-version" ? "unsupported" : "damaged", message: message(e) };
          if (row.status !== "unsupported" && sorted[1]) try { const prior = await read(sorted[1], raw); if (prior.kind === "design") row.recovery = { generation: prior.generation, updatedAt: prior.updatedAt }; } catch { /* Row remains visibly damaged. */ }
          rows.push(row);
        }
      }
      return { rows, issues, totalBytes: (await inventory()).totalBytes, ...(scan.unknownEntries ? { recovery: "unrecognized-files" as const } : {}) };
    }),
    save: input => {
      // Capture the editable values and asset strings before yielding to the queue.
      let captured: SaveInput;
      try { captured = { ...input, title: validateTitle(input.title), draft: snapshotDraft(input.draft) as Draft, assets: Object.fromEntries(Object.entries(input.assets || {}).map(([role, asset]) => [role, { ...asset }])) }; }
      catch (e) { return Promise.reject(e instanceof LibraryError ? e : new LibraryError("invalid", e instanceof Error ? e.message : "Invalid design.")); }
      return queue(async () => {
        const { scan } = await startup();
        if (scan.unknownEntries) fail("unsupported-version", "Unrecognized local files need review or an explicit reset before saving.");
        const raw = (await key(scan.entries.length > 0 || scan.totalBytes > 0, true))!;
        let id = captured.id, generation = 1, createdAt = a.now();
        if (id) {
          const prior = await current(id, raw);
          if (captured.expectedGeneration !== prior.record.generation) fail("conflict", "This design changed. Reopen it before saving changes.");
          generation = prior.record.generation + 1; createdAt = prior.record.createdAt;
          // Successful validation of the current save allows removal of older versions.
          await prune(prior.entries, prior.sorted[0]);
        } else {
          if (group(scan.entries).size >= LIMITS.designs) fail("quota", "You can save up to 20 designs. Delete one before adding another.");
          id = a.crypto.uuid(); validId(id);
          if (scan.entries.some(e => e.id === id)) fail("conflict", "A saved identifier already exists. Try again.");
        }
        validGeneration(generation);
        const record = validateRecord({ schemaVersion: 1, kind: "design", id, generation, createdAt, updatedAt: a.now(), title: captured.title, draft: captured.draft, assets: captured.assets }) as DesignRecord;
        await commit(record, raw); return record;
      });
    },
    open: (id, options) => queue(async () => {
      const { raw } = await startup();
      if (!raw) fail("not-found", "No saved designs are available.");
      const value = await current(id, raw, options?.recoverPrevious);
      if (!options?.recoverPrevious) {
        try { await prune(value.entries, value.sorted[0]); }
        catch { fail("cleanup", "This save is readable, but older files need cleanup. Retry opening it."); }
      }
      return value.record;
    }),
    rename: (id, title, expectedGeneration) => queue(async () => {
      const cleanTitle = validateTitle(title), { raw } = await startup();
      if (!raw) fail("not-found", "No saved designs are available.");
      const prior = await current(id, raw);
      if (prior.record.generation !== expectedGeneration) fail("conflict", "This design changed. Reopen it before renaming.");
      await prune(prior.entries, prior.sorted[0]);
      const record: DesignRecord = { ...prior.record, title: cleanTitle, generation: prior.record.generation + 1, updatedAt: a.now() };
      await commit(record, raw); return record;
    }),
    delete: id => queue(async () => {
      validId(id);
      const { scan, raw } = await startup();
      const entries = scan.entries.filter(e => e.id === id), sorted = generations(entries);
      if (!sorted.length) { await a.files.removeEmpty(id); return; }
      if (!raw) fail("key-missing", "Use Delete inaccessible local saves to reset the library.");
      let highest: LibraryRecord | undefined;
      try { highest = await read(sorted[0], raw); }
      catch (e) { if (e instanceof LibraryError && e.code === "unsupported-version") throw e; }
      if (highest?.kind === "deleted") { await cleanupDeleted(highest, entries); return; }
      const now = a.now();
      const tombstone: LibraryRecord = { schemaVersion: 1, kind: "deleted", id, generation: parseName(sorted[0].name)! + 1, createdAt: highest?.createdAt || now, updatedAt: now };
      await commit(tombstone, raw);
      try { await cleanupDeleted(tombstone, (await inventory()).entries.filter(e => e.id === id)); }
      catch { fail("cleanup", "This design is hidden, but encrypted files still need deletion. Retry deletion."); }
    }),
    reset: () => queue(async () => {
      await a.files.reset();
      const scan = await inventory();
      if (scan.entries.length || scan.totalBytes || scan.unknownEntries) fail("cleanup", "Local files remain. The key was retained; retry deletion.");
      try { await a.keys.remove(); } catch { fail("key-unavailable", "Saved files were removed but the old key still needs cleanup. Retry reset."); }
      pendingPrunes.clear();
      started = false;
    }),
  };
  return library;
}
