import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/client";
import { rateLimit } from "@/lib/domains/store";

export class AuthRateLimitError extends Error {}

/** Shared atomic DB buckets, not per-process counters. Never store raw email/IP. */
export async function authRateLimit(subject: string, action: string, limit: number, seconds: number) {
  const hash = createHash("sha256").update(subject).digest("hex");
  try {
    await rateLimit((text, values) => getSql().query(text, values), "auth:" + hash, action, limit, seconds);
  } catch (error) {
    if (error instanceof Error && error.message === "Too many requests. Please try again shortly.") throw new AuthRateLimitError(error.message);
    throw error;
  }
}
