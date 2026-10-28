import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { rate } from "@/lib/support/service";
/** IP-derived opaque bucket, alongside each token's acceptance limit. */
export async function limitInvitationRequest(kind: "view" | "accept") {
  const h = await headers();
  const ip = (
    h.get("x-vercel-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for") ||
    "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 128);
  await rate(
    "role-invitation-" +
      kind +
      ":" +
      createHash("sha256").update(ip).digest("hex").slice(0, 32),
    kind === "view" ? 60 : 20,
  );
}
