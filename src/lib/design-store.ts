import { designName, updateSavedDesign, type EditorDraft, type DesignArtifact, type SavedDesign } from './editor-draft';
const DATABASE = 'qr-upgrade-designs';
const STORE = 'designs';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('This browser cannot save designs. You can still download your QR.'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable. Allow site storage to save designs.'));
    request.onblocked = () => reject(new Error('Close other QR Upgrade tabs and try again.'));
  });
}
async function transaction<T>(write: boolean, run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, write ? 'readwrite' : 'readonly');
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Your browser storage is full. Download a copy, or free some browser storage.' : 'The design could not be saved. Please try again.')); };
    try { run(tx.objectStore(STORE), (value) => { result = value; }); }
    catch (error) { tx.abort(); db.close(); reject(error); }
  });
}
export async function listDesigns(): Promise<SavedDesign[]> {
  return transaction(false, (store, done) => { const request = store.getAll(); request.onsuccess = () => done((request.result as SavedDesign[]).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))); });
}
export async function saveDesign(draft: EditorDraft, artifact: DesignArtifact, id?: string): Promise<SavedDesign> {
  const designId = id || crypto.randomUUID();
  return transaction(true, (store, done) => {
    const request = store.get(designId);
    request.onsuccess = () => { const value = updateSavedDesign(request.result, draft, artifact, designId, new Date().toISOString()); store.put(value); done(value); };
  });
}
export async function changeDesign(id: string, action: 'archive' | 'restore' | 'rename' | 'duplicate', name?: string): Promise<SavedDesign> {
  return transaction(true, (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result as SavedDesign | undefined;
      if (!item) { store.transaction.abort(); return; }
      const updated = { ...item, updatedAt: new Date().toISOString() };
      if (action === 'duplicate') { updated.id = crypto.randomUUID(); updated.name = designName(`${item.name} copy`); updated.createdAt = updated.updatedAt; updated.history = []; updated.archived = false; }
      if (action === 'rename') updated.name = designName(name || '');
      if (action === 'archive' || action === 'restore') updated.archived = action === 'archive';
      updated.draft = { ...item.draft, name: updated.name };
      store.put(updated); done(updated);
    };
  });
}
