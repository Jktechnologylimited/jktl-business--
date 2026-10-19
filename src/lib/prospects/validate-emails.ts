import "server-only";
import { resolve4, resolveMx } from "node:dns/promises";
import { getSql } from "@/lib/db/client";
import {
  checkDomainMail,
  combineEmailChecks,
  domainOf,
  uniqueDomains,
  type DnsResolver,
  type MxResult,
} from "./email-validation";

/**
 * Checks whether the addresses in an import can actually receive mail.
 *
 * This is the step that decides whether a cold-email domain survives. Hard
 * bounces above roughly 2% get a domain throttled and then blocklisted, and that
 * takes the transactional mail down with it — booking confirmations, receipts,
 * invoice notifications. The mail that must never be blocked. So the list is
 * cleaned before a single message is sent, not after the damage.
 *
 * **MX lookups are batched by domain.** A 5,000-row list is usually a few hundred
 * distinct domains, so querying per address would be ten times the DNS traffic
 * for the same answer. Domains are resolved concurrently, bounded, because an
 * unbounded `Promise.all` over thousands of lookups gets rate-limited by the
 * resolver and produces a list of false "invalid" verdicts.
 */

const CONCURRENCY = 12;

const resolver: DnsResolver = {
  resolveMx: (domain: string) => resolveMx(domain),
  resolve4: (domain: string) => resolve4(domain),
};

export interface ValidationRun {
  checked: number;
  valid: number;
  risky: number;
  invalid: number;
  domainsQueried: number;
  dnsFailures: number;
}

/**
 * Validates up to `limit` unchecked prospects and records the verdict.
 *
 * Idempotent by `email_checked_at`: a prospect already checked is skipped, so
 * this can run after every import without re-querying DNS for the whole table.
 */
export async function validateProspectEmails(limit = 1000): Promise<ValidationRun> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email FROM prospects
    WHERE email <> '' AND email_checked_at IS NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) {
    return { checked: 0, valid: 0, risky: 0, invalid: 0, domainsQueried: 0, dnsFailures: 0 };
  }

  const emails = rows.map((row) => row.email as string);
  const domains = uniqueDomains(emails);

  // Resolve each distinct domain once.
  const mxByDomain = new Map<string, MxResult>();
  let dnsFailures = 0;
  for (let start = 0; start < domains.length; start += CONCURRENCY) {
    const batch = domains.slice(start, start + CONCURRENCY);
    const results = await Promise.all(batch.map((domain) => checkDomainMail(domain, resolver)));
    for (const result of results) {
      mxByDomain.set(result.domain, result);
      if (result.hasMail === null) dnsFailures += 1;
    }
  }

  let valid = 0;
  let risky = 0;
  let invalid = 0;

  // One statement per batch of rows, using the same shape as the import.
  const updates: Array<{ id: string; status: string; note: string }> = [];
  for (const row of rows) {
    const email = row.email as string;
    const check = combineEmailChecks(email, mxByDomain.get(domainOf(email)) ?? null);
    if (check.status === "valid") valid += 1;
    else if (check.status === "risky") risky += 1;
    else if (check.status === "invalid") invalid += 1;
    updates.push({ id: row.id as string, status: check.status, note: check.note.slice(0, 200) });
  }

  const BATCH = 500;
  for (let start = 0; start < updates.length; start += BATCH) {
    const batch = updates.slice(start, start + BATCH);
    await sql`
      UPDATE prospects p SET
        email_status = v.status,
        email_check_note = v.note,
        email_checked_at = now()
      FROM UNNEST(
        ${batch.map((b) => b.id)}::uuid[],
        ${batch.map((b) => b.status)}::text[],
        ${batch.map((b) => b.note)}::text[]
      ) AS v(id, status, note)
      WHERE p.id = v.id
    `;
  }

  return {
    checked: rows.length,
    valid,
    risky,
    invalid,
    domainsQueried: domains.length,
    dnsFailures,
  };
}

/** How many leads are still unvalidated, so the admin knows whether the list is
 * ready to send to. */
export async function countUnvalidatedEmails(): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM prospects WHERE email <> '' AND email_checked_at IS NULL`;
  return Number((rows[0] as Record<string, unknown>)?.n ?? 0);
}

/** The verdict breakdown, for the admin's list-quality panel. */
export async function emailQualityBreakdown(): Promise<Record<string, number>> {
  const sql = getSql();
  const rows = await sql`
    SELECT email_status, COUNT(*)::int AS n FROM prospects WHERE email <> '' GROUP BY email_status
  `;
  const out: Record<string, number> = { valid: 0, risky: 0, invalid: 0, unknown: 0 };
  for (const row of rows) out[row.email_status as string] = Number(row.n ?? 0);
  return out;
}
