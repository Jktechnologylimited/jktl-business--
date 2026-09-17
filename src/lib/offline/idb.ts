"use client";

const DB_NAME = "jktl-offline";
const DB_VERSION = 1;
const STORE_CACHE = "cache";
const STORE_OUTBOX = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB isn't available in this environment."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "orgId" });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

// ---- Cache: one full tenant snapshot per org ----

export interface CachedTenant {
  orgId: string;
  data: unknown;
  pulledAt: string;
}

export async function getCachedTenant(orgId: string): Promise<CachedTenant | null> {
  try {
    const result = await run<CachedTenant | undefined>(STORE_CACHE, "readonly", (s) => s.get(orgId));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function putCachedTenant(orgId: string, data: unknown): Promise<void> {
  try {
    await run(STORE_CACHE, "readwrite", (s) => s.put({ orgId, data, pulledAt: new Date().toISOString() }));
  } catch {
    // Best-effort — if IndexedDB is unavailable, the app still works online, just without offline durability.
  }
}

// ---- Outbox: pending mutations, processed in insertion order ----

export interface OutboxEntry {
  id: number;
  type: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
}

export async function addOutboxEntry(type: string, payload: unknown): Promise<void> {
  try {
    await run(STORE_OUTBOX, "readwrite", (s) => s.add({ type, payload, createdAt: new Date().toISOString(), attempts: 0 }));
  } catch {
    // If this fails, the mutation still applied optimistically in memory —
    // it just won't survive a reload until the next successful cache write.
  }
}

export async function getOutboxEntries(): Promise<OutboxEntry[]> {
  try {
    return await run<OutboxEntry[]>(STORE_OUTBOX, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function removeOutboxEntry(id: number): Promise<void> {
  try {
    await run(STORE_OUTBOX, "readwrite", (s) => s.delete(id));
  } catch {
    // Non-fatal — worst case this entry is retried again later.
  }
}

export async function bumpOutboxAttempts(id: number): Promise<void> {
  try {
    const entry = await run<OutboxEntry | undefined>(STORE_OUTBOX, "readonly", (s) => s.get(id));
    if (entry) await run(STORE_OUTBOX, "readwrite", (s) => s.put({ ...entry, attempts: entry.attempts + 1 }));
  } catch {
    // Non-fatal.
  }
}

export async function outboxCount(): Promise<number> {
  return (await getOutboxEntries()).length;
}
