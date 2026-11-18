import { ArtworkAsset } from '../types';

/**
 * Per-user persistent Gallery, stored in this browser's IndexedDB.
 *
 * - One record per design (`assets` store, key `${userId}::${assetId}`), holding the
 *   whole ArtworkAsset (its images are data-URL strings, so it is fully serialisable).
 * - One `order` record per user with the gallery order, so reordering never
 *   rewrites the (large) image records.
 * - Saves are diffed against what was last written: only designs whose object
 *   changed are re-written, removed designs are deleted.
 */

const DB_NAME = 'dtf-gallery';
const DB_VERSION = 1;
const ASSETS = 'assets';
const ORDER = 'order';

interface AssetRecord {
  key: string;
  userId: string;
  asset: ArtworkAsset;
}

interface OrderRecord {
  userId: string;
  ids: string[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ASSETS)) {
        const store = db.createObjectStore(ASSETS, { keyPath: 'key' });
        store.createIndex('byUser', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(ORDER)) {
        db.createObjectStore(ORDER, { keyPath: 'userId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null; // allow a retry later
    throw err;
  });
  return dbPromise;
}

const recordKey = (userId: string, assetId: string) => `${userId}::${assetId}`;

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/** Asks the browser not to evict the gallery under storage pressure (best effort). */
export function requestPersistentStorage(): void {
  try {
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // not supported
  }
}

/** Loads a user's saved designs in gallery order. Rejects if storage is unavailable. */
export async function loadGallery(userId: string): Promise<ArtworkAsset[]> {
  const db = await openDb();
  const tx = db.transaction([ASSETS, ORDER], 'readonly');
  const recordsReq = tx.objectStore(ASSETS).index('byUser').getAll(userId);
  const orderReq = tx.objectStore(ORDER).get(userId);
  await txDone(tx);
  const records = (recordsReq.result || []) as AssetRecord[];
  const order = ((orderReq.result as OrderRecord | undefined)?.ids) || [];
  const pos = new Map(order.map((id, i) => [id, i]));
  return records
    .map((r) => r.asset)
    .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Writes the user's current gallery. `lastSaved` maps asset id -> the object last
 * written; it is updated in place so the next call only writes what changed.
 */
export async function saveGallery(
  userId: string,
  assets: ArtworkAsset[],
  lastSaved: Map<string, ArtworkAsset>
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([ASSETS, ORDER], 'readwrite');
  const store = tx.objectStore(ASSETS);
  const current = new Set(assets.map((a) => a.id));
  const written: ArtworkAsset[] = [];
  for (const a of assets) {
    if (lastSaved.get(a.id) !== a) {
      store.put({ key: recordKey(userId, a.id), userId, asset: a } satisfies AssetRecord);
      written.push(a);
    }
  }
  const removed = [...lastSaved.keys()].filter((id) => !current.has(id));
  for (const id of removed) store.delete(recordKey(userId, id));
  tx.objectStore(ORDER).put({ userId, ids: assets.map((a) => a.id) } satisfies OrderRecord);
  await txDone(tx);
  for (const a of written) lastSaved.set(a.id, a);
  for (const id of removed) lastSaved.delete(id);
}
