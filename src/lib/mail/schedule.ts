import "server-only";
import { after } from "next/server";
import { runEmailMaintenance } from "@/lib/business-email/notifications";
/** Durable outbox first; provider errors never undo the successful account action. */
export function flushMailAfterResponse() {
  after(async () => {
    try {
      await runEmailMaintenance();
    } catch {
      /* Existing scheduled maintenance retries the durable queue. */
    }
  });
}
