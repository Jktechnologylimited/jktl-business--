import "server-only";
import { randomUUID } from "node:crypto";
import type { Query } from "./model";

export type Go54Diagnostic = {
  operation: string;
  method: "GET" | "POST";
  httpStatus: number | null;
  jsonValid: boolean;
  payload: unknown;
  observedAt: string;
};
/** Preserve unknown JSON structure, never raw credential/EPP/contact values.
 * EPP/contact reads redact every scalar because their field names are unknown. */
export function sanitizeGo54Payload(
  payload: unknown,
  operation: string,
  secrets: string[] = [],
): unknown {
  let budget = 32768,
    nodes = 0;
  const allPrivate = operation === "epp.read" || operation === "contacts.read";
  const sensitive =
    /(?:token|secret|password|api.?key|authorization|epp|auth.?code|contact|registrant|email|phone|address|first.?name|last.?name|full.?name|company.?name|zip.?code|postal)/i;
  const privateValues = [
    ...new Set(secrets.filter((v) => typeof v === "string" && v.length > 0)),
  ];
  function text(value: string) {
    let clean = value;
    for (const secret of privateValues) {
      if (clean === secret) return "[REDACTED]";
      if (secret.length >= 4) {
        for (const variant of [
          secret,
          encodeURIComponent(secret),
          new URLSearchParams({ v: secret }).toString().slice(2),
          Buffer.from(secret, "utf8").toString("base64"),
        ])
          clean = clean.split(variant).join("[REDACTED]");
      }
    }
    // A greedy email-matching regex on a long upstream string can be
    // quadratic. Redact the entire potentially email-bearing value in linear
    // time; preserving its unknown field name is sufficient for diagnostics.
    if (clean.includes("@")) clean = "[REDACTED]";
    return clean.length > 1000 ? clean.slice(0, 1000) + "[TRUNCATED]" : clean;
  }
  function visit(
    value: unknown,
    privateBranch: boolean,
    depth: number,
  ): unknown {
    if (++nodes > 1000 || budget <= 0 || depth > 8) return "[TRUNCATED]";
    if (value === null) return null;
    if (Array.isArray(value))
      return value.slice(0, 100).map((v) => visit(v, privateBranch, depth + 1));
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, v] of Object.entries(value).slice(0, 100)) {
        const name = text(key).slice(0, 120);
        budget -= name.length;
        result[name] = visit(
          v,
          privateBranch || sensitive.test(key),
          depth + 1,
        );
      }
      return result;
    }
    if (privateBranch || allPrivate) return "[REDACTED]";
    if (typeof value === "string") {
      const clean = text(value);
      budget -= clean.length;
      return clean;
    }
    if (typeof value === "number" || typeof value === "boolean")
      return privateValues.includes(String(value)) ? "[REDACTED]" : value;
    return "[REDACTED]";
  }
  return visit(payload, false, 0);
}

/** Called only by server-side, capability-checked diagnostic capture actions.
 * No caller can submit a browser JSON body and call it a provider response. */
export async function recordGo54Diagnostic(
  q: Query,
  actor: string,
  diagnostic: Go54Diagnostic,
) {
  const id = randomUUID();
  await q(
    `WITH captured AS(INSERT INTO domain_registrar_diagnostics(id,actor_id,operation,method,http_status,json_valid,sanitized_payload,observed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz) RETURNING id)
    INSERT INTO domain_audit(actor_id,actor_type,event,detail) SELECT $2,'admin','REGISTRAR_DIAGNOSTIC_CAPTURED',jsonb_build_object('diagnostic',id) FROM captured`,
    [
      id,
      actor,
      diagnostic.operation,
      diagnostic.method,
      diagnostic.httpStatus,
      diagnostic.jsonValid,
      JSON.stringify(
        sanitizeGo54Payload(diagnostic.payload, diagnostic.operation, [
          process.env.GO54_API_KEY || "",
          process.env.GO54_RESELLER_EMAIL || "",
          process.env.GO54_API_EMAIL || "",
        ]),
      ),
      diagnostic.observedAt,
    ],
  );
  return id;
}
