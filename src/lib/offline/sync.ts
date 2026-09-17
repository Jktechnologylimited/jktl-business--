"use client";

import { bumpOutboxAttempts, getOutboxEntries, outboxCount, removeOutboxEntry } from "./idb";
import { MUTATION_HANDLERS } from "./mutation-registry";
import { useToastStore } from "@/lib/toast";

let syncing = false;

export type SyncListener = (pendingCount: number) => void;
const listeners = new Set<SyncListener>();

export function onSyncProgress(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function notify() {
  const count = await outboxCount();
  listeners.forEach((l) => l(count));
}

/**
 * Drains the outbox in insertion order. A thrown error (network/transport
 * failure — the request never reached the server) stops the loop so order
 * is preserved and the same entry is retried next time. A resolved
 * `{ok:false}` (the server was reached but rejected the operation, e.g. a
 * stale reference) is logged and dropped — retrying a rejected mutation
 * forever wouldn't fix it, so we surface it once via toast and move on.
 */
export async function processOutbox(): Promise<void> {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;

  try {
    const entries = await getOutboxEntries();
    let droppedCount = 0;

    for (const entry of entries.sort((a, b) => a.id - b.id)) {
      const handler = MUTATION_HANDLERS[entry.type];
      if (!handler) {
        await removeOutboxEntry(entry.id);
        continue;
      }
      try {
        const result = await handler(entry.payload);
        if (result.ok) {
          await removeOutboxEntry(entry.id);
        } else {
          console.error(`Sync rejected (${entry.type}):`, result.error);
          await removeOutboxEntry(entry.id);
          droppedCount += 1;
        }
      } catch (err) {
        await bumpOutboxAttempts(entry.id);
        console.warn(`Sync paused — couldn't reach the server for ${entry.type}:`, err);
        break; // preserve order; stop here and retry the whole tail later
      }
      await notify();
    }

    if (droppedCount > 0) {
      useToastStore.getState().show(
        droppedCount === 1
          ? "One change couldn't be saved to the server and was discarded."
          : `${droppedCount} changes couldn't be saved to the server and were discarded.`,
        "danger",
      );
    }
  } finally {
    syncing = false;
    await notify();
  }
}

export { outboxCount };
