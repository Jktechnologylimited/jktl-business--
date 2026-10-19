import "server-only";
import { getSql } from "./client";
import { isoDate } from "./rows";
import type {
  AuditFinding,
  CountryRuleRow,
  OutreachSettings,
  Prospect,
  ProspectFilters,
  ProspectInput,
  ProspectOutreach,
  ProspectRun,
  ProspectSource,
  ProspectStats,
  ProspectStatus,
  WebsiteStatus,
} from "@/lib/prospects/types";
import { resolveSettings } from "@/lib/prospects/outreach";
import { enrichmentFromRaw } from "@/lib/prospects/enrichment";

/**
 * Queries for the prospecting engine. Platform-level data: no function here
 * takes an organization id, because a prospect is not a tenant until its site
 * has been generated and claimed.
 */

function jsonFindings(value: unknown): AuditFinding[] {
  if (Array.isArray(value)) return value as AuditFinding[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as AuditFinding[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapProspect(row: Record<string, unknown>): Prospect {
  return {
    id: row.id as string,
    source: row.source as ProspectSource,
    sourceRef: (row.source_ref as string) ?? "",
    businessName: row.business_name as string,
    niche: (row.niche as string) ?? "",
    category: (row.category as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    emailStatus: (row.email_status as Prospect["emailStatus"]) ?? "unknown",
    enrichment: (row.enrichment as Record<string, unknown>) ?? {},
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    state: (row.state as string) ?? "",
    country: (row.country as string) ?? "NG",
    website: (row.website as string) ?? "",
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    reviews: row.reviews === null || row.reviews === undefined ? null : Number(row.reviews),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    websiteStatus: (row.website_status as WebsiteStatus) ?? "unaudited",
    websiteScore: row.website_score === null || row.website_score === undefined ? null : Number(row.website_score),
    auditFindings: jsonFindings(row.audit_findings),
    auditedAt: row.audited_at ? isoDate(row.audited_at as string) : null,
    siteOrganizationId: (row.site_organization_id as string) ?? null,
    siteSubdomain: (row.site_subdomain as string) ?? "",
    siteBuiltAt: row.site_built_at ? isoDate(row.site_built_at as string) : null,
    status: (row.status as ProspectStatus) ?? "new",
    suppressed: Boolean(row.suppressed),
    consentAt: row.consent_at ? isoDate(row.consent_at as string) : null,
    consentNote: (row.consent_note as string) ?? "",
    blockedReason: (row.blocked_reason as string) ?? "",
    unsubscribeToken: (row.unsubscribe_token as string) ?? "",
    notes: (row.notes as string) ?? "",
    createdAt: isoDate(row.created_at as string),
    lastContactedAt: row.last_contacted_at ? isoDate(row.last_contacted_at as string) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Runs                                                                       */
/* -------------------------------------------------------------------------- */

export async function startRun(params: {
  source: ProspectSource;
  niche: string;
  query: string;
  location: string;
  adminUserId: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO prospect_runs (source, niche, query, location, requested_by)
    VALUES (${params.source}, ${params.niche}, ${params.query}, ${params.location}, ${params.adminUserId})
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function finishRun(
  runId: string,
  result: { status: "ok" | "failed"; found?: number; imported?: number; duplicates?: number; error?: string },
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospect_runs SET
      status = ${result.status},
      found = ${result.found ?? 0},
      imported = ${result.imported ?? 0},
      duplicates = ${result.duplicates ?? 0},
      error = ${result.error ?? ""},
      finished_at = now()
    WHERE id = ${runId}
  `;
}

export async function listRuns(limit = 10): Promise<ProspectRun[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM prospect_runs ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map((row) => ({
    id: row.id as string,
    source: row.source as ProspectSource,
    niche: (row.niche as string) ?? "",
    query: (row.query as string) ?? "",
    location: (row.location as string) ?? "",
    found: Number(row.found ?? 0),
    imported: Number(row.imported ?? 0),
    duplicates: Number(row.duplicates ?? 0),
    status: row.status as ProspectRun["status"],
    error: (row.error as string) ?? "",
    createdAt: isoDate(row.created_at as string),
    finishedAt: row.finished_at ? isoDate(row.finished_at as string) : null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

export interface ImportResult {
  imported: number;
  duplicates: number;
}

/**
 * Stores normalized leads.
 *
 * `ON CONFLICT DO NOTHING` on the (source, source_ref) unique index is what
 * makes re-running the same search safe: a second scrape of "men's clinic,
 * Yenagoa" adds only the businesses that appeared since, and never re-audits
 * or re-emails anybody. An unsubscribe token is minted per row here, so every
 * prospect has a working opt-out from the moment it exists.
 */
/**
 * Stores normalized leads.
 *
 * **Batched, because of scale.** The original inserted one row per round trip,
 * which is fine for forty leads and unusable for twelve thousand — at roughly a
 * millisecond of latency each, a single import would take minutes of pure
 * network time and time out long before it finished. This sends the whole array
 * as one parameterised `UNNEST`, so the cost is one statement per 500 rows
 * rather than one statement per row.
 *
 * `ON CONFLICT DO NOTHING` on the (source, source_ref) unique index keeps a
 * re-scrape safe: running the same search next month adds only what appeared
 * since, and never re-audits or re-emails anybody. An unsubscribe token is
 * minted per row, so every prospect has a working opt-out from the moment it
 * exists.
 */
export async function importProspects(inputs: ProspectInput[], searchArea = ""): Promise<ImportResult> {
  if (inputs.length === 0) return { imported: 0, duplicates: 0 };
  const sql = getSql();
  const BATCH = 500;
  let imported = 0;

  for (let start = 0; start < inputs.length; start += BATCH) {
    const batch = inputs.slice(start, start + BATCH);
    const rows = await sql`
      INSERT INTO prospects (
        source, source_ref, business_name, niche, category, phone, email, address, city, state, country,
        website, rating, reviews, latitude, longitude, unsubscribe_token, search_area, raw, enrichment, enriched_at
      )
      SELECT * FROM UNNEST(
        ${batch.map((b) => b.source)}::text[],
        ${batch.map((b) => b.sourceRef)}::text[],
        ${batch.map((b) => b.businessName)}::text[],
        ${batch.map((b) => b.niche)}::text[],
        ${batch.map((b) => b.category)}::text[],
        ${batch.map((b) => b.phone)}::text[],
        ${batch.map((b) => b.email)}::text[],
        ${batch.map((b) => b.address)}::text[],
        ${batch.map((b) => b.city)}::text[],
        ${batch.map((b) => b.state)}::text[],
        ${batch.map((b) => b.country)}::text[],
        ${batch.map((b) => b.website)}::text[],
        ${batch.map((b) => b.rating)}::numeric[],
        ${batch.map((b) => b.reviews)}::integer[],
        ${batch.map((b) => b.latitude)}::numeric[],
        ${batch.map((b) => b.longitude)}::numeric[],
        ${batch.map(() => crypto.randomUUID().replace(/-/g, ""))}::text[],
        ${batch.map(() => searchArea)}::text[],
        ${batch.map((b) => (b.raw ? JSON.stringify(b.raw) : null))}::jsonb[],
        ${batch.map((b) => JSON.stringify(enrichmentFromRaw(b.raw, b.city)))}::jsonb[],
        ${batch.map(() => new Date().toISOString())}::timestamptz[]
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    imported += rows.length;
  }

  return { imported, duplicates: inputs.length - imported };
}

/**
 * Marks leads that are already JKTL customers.
 *
 * A cold email to an existing customer — worse, telling them they have a poor
 * website when we built it — is the single most damaging thing this engine could
 * do. So it runs on every import, and the reason is recorded so a large import
 * is auditable rather than mysterious.
 *
 * Matched on the last nine digits of the phone number, which is how the missed
 * call pipeline already identifies a caller, plus the business name and city as a
 * fallback for listings with no phone.
 */
export async function excludeExistingCustomers(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE prospects p SET
      excluded_reason = 'Already a JKTL customer',
      status = 'rejected',
      updated_at = now()
    WHERE p.excluded_reason = ''
      AND (
        EXISTS (
          SELECT 1 FROM business_profiles bp
          WHERE bp.phone <> '' AND p.phone <> ''
            AND right(regexp_replace(bp.phone, '[^0-9]', '', 'g'), 9) = right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 9)
        )
        OR EXISTS (
          SELECT 1 FROM business_profiles bp2
          WHERE lower(bp2.display_name) = lower(p.business_name)
            AND lower(bp2.city) = lower(p.city)
            AND p.city <> ''
        )
      )
    RETURNING p.id
  `;
  return rows.length;
}

export async function listProspects(filters: ProspectFilters = {}): Promise<Prospect[]> {
  const sql = getSql();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  const websiteStatus = filters.websiteStatus && filters.websiteStatus !== "all" ? filters.websiteStatus : null;
  const niche = filters.niche && filters.niche !== "all" ? filters.niche : null;
  const city = filters.city?.trim() || null;
  const search = filters.search?.trim() || null;

  const rows = await sql`
    SELECT p.*, o.sent_at AS last_contacted_at
    FROM prospects p
    LEFT JOIN LATERAL (
      SELECT sent_at FROM prospect_outreach WHERE prospect_id = p.id ORDER BY sent_at DESC LIMIT 1
    ) o ON true
    WHERE (${status}::text IS NULL OR p.status = ${status})
      AND (${websiteStatus}::text IS NULL OR p.website_status = ${websiteStatus})
      AND (${niche}::text IS NULL OR p.niche = ${niche})
      AND (${city}::text IS NULL OR p.city ILIKE ${city ? `%${city}%` : null})
      AND (${search}::text IS NULL OR p.business_name ILIKE ${search ? `%${search}%` : null} OR p.category ILIKE ${search ? `%${search}%` : null})
    ORDER BY
      -- Best leads first: no site at all, then broken, then poor.
      CASE p.website_status WHEN 'none' THEN 0 WHEN 'unreachable' THEN 1 WHEN 'social_only' THEN 2 WHEN 'poor' THEN 3 ELSE 4 END,
      p.reviews DESC NULLS LAST,
      p.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapProspect);
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT p.*, o.sent_at AS last_contacted_at
    FROM prospects p
    LEFT JOIN LATERAL (
      SELECT sent_at FROM prospect_outreach WHERE prospect_id = p.id ORDER BY sent_at DESC LIMIT 1
    ) o ON true
    WHERE p.id = ${id}
  `;
  return rows[0] ? mapProspect(rows[0]) : null;
}

export async function listProspectsNeedingAudit(limit = 25): Promise<Prospect[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM prospects
    WHERE website_status = 'unaudited' AND suppressed = false
    ORDER BY created_at ASC LIMIT ${limit}
  `;
  return rows.map(mapProspect);
}

/**
 * Stores an audit verdict.
 *
 * `qualified` is passed in from `isQualifiedLead` rather than re-derived here:
 * that decision is a policy about what makes a good lead (a low score, or any
 * one critical fault), and it belongs in one place — `src/lib/prospects/audit.ts`
 * — with its own tests, not duplicated as a SQL CASE that could drift from it.
 */
export async function recordAudit(
  id: string,
  audit: { status: WebsiteStatus; score: number; findings: AuditFinding[]; qualified: boolean },
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospects SET
      website_status = ${audit.status},
      website_score = ${audit.score},
      audit_findings = ${JSON.stringify(audit.findings)}::jsonb,
      audited_at = now(),
      -- A site that turns out to be fine is not a lead; one that doesn't is.
      -- A prospect already contacted or converted is never demoted by a
      -- re-audit.
      status = CASE
        WHEN ${audit.qualified} THEN 'qualified'
        WHEN status IN ('new', 'qualified') THEN 'rejected'
        ELSE status
      END,
      updated_at = now()
    WHERE id = ${id}
  `;
}

export async function setProspectStatus(id: string, status: ProspectStatus, notes?: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospects SET
      status = ${status},
      notes = COALESCE(${notes ?? null}, notes),
      updated_at = now()
    WHERE id = ${id}
  `;
}

export async function recordSiteBuilt(id: string, organizationId: string, subdomain: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospects SET
      site_organization_id = ${organizationId},
      site_subdomain = ${subdomain},
      site_built_at = now(),
      status = CASE WHEN status IN ('replied', 'contacted') THEN status ELSE 'site_built' END,
      updated_at = now()
    WHERE id = ${id}
  `;
}

/* -------------------------------------------------------------------------- */
/* Outreach                                                                   */
/* -------------------------------------------------------------------------- */

export async function getOutreachSettings(): Promise<OutreachSettings> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM outreach_settings WHERE id = 'default'`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return resolveSettings(null);
  return resolveSettings({
    senderBusinessName: row.sender_business_name as string,
    fromEmail: row.from_email as string,
    replyTo: row.reply_to as string,
    subjectTemplate: row.subject_template as string,
    dailySendCap: Number(row.daily_send_cap ?? 40),
    includeAudit: Boolean(row.include_audit),
    calendarLink: row.calendar_link as string,
  });
}

export async function updateOutreachSettings(input: OutreachSettings): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE outreach_settings SET
      sender_business_name = ${input.senderBusinessName},
      from_email = ${input.fromEmail},
      reply_to = ${input.replyTo},
      subject_template = ${input.subjectTemplate},
      daily_send_cap = ${input.dailySendCap},
      include_audit = ${input.includeAudit},
      calendar_link = ${input.calendarLink},
      updated_at = now()
    WHERE id = 'default'
  `;
}

/** How many emails have gone out in the last 24 hours — checked before every
 * send, because the cap is what keeps a sending domain alive. */
export async function countSentToday(): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM prospect_outreach
    WHERE status = 'sent' AND sent_at >= now() - interval '24 hours'
  `;
  return Number(((rows[0] ?? {}) as Record<string, unknown>).n ?? 0);
}

export async function recordOutreach(input: {
  prospectId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  error?: string;
  adminUserId: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO prospect_outreach (prospect_id, to_email, subject, body, status, error, admin_user_id)
    VALUES (${input.prospectId}, ${input.toEmail}, ${input.subject}, ${input.body}, ${input.status}, ${input.error ?? ""}, ${input.adminUserId})
  `;
  if (input.status === "sent") {
    await sql`
      UPDATE prospects SET
        status = CASE WHEN status = 'converted' THEN status ELSE 'contacted' END,
        updated_at = now()
      WHERE id = ${input.prospectId}
    `;
  }
}

export async function listOutreachFor(prospectId: string): Promise<ProspectOutreach[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM prospect_outreach WHERE prospect_id = ${prospectId} ORDER BY sent_at DESC
  `;
  return rows.map((row) => ({
    id: row.id as string,
    prospectId: row.prospect_id as string,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    body: row.body as string,
    status: row.status as ProspectOutreach["status"],
    error: (row.error as string) ?? "",
    sentAt: isoDate(row.sent_at as string),
  }));
}

/** Candidates for the next send: qualified, have a site or don't need one,
 * have an address, haven't been contacted, and haven't opted out. */
export async function listOutreachCandidates(limit = 25): Promise<Prospect[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM prospects
    WHERE suppressed = false
      AND email <> ''
      AND status IN ('qualified', 'site_built')
      AND site_built_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM prospect_outreach o WHERE o.prospect_id = prospects.id AND o.status = 'sent')
    ORDER BY
      CASE website_status WHEN 'none' THEN 0 WHEN 'unreachable' THEN 1 WHEN 'social_only' THEN 2 ELSE 3 END,
      reviews DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map(mapProspect);
}

/**
 * True when an organization exists only because we built a prospect a site.
 *
 * The public site page uses this for two things, both of which matter: the
 * site gets a visible "this is a preview" notice, and it is served `noindex`.
 * A website we made for a business that has not agreed to it must not end up
 * ranking above the site they actually own.
 */
export async function isProspectOrganization(orgId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT is_prospect FROM organizations WHERE id = ${orgId}`;
  return Boolean((rows[0] ?? {}).is_prospect);
}

/* -------------------------------------------------------------------------- */
/* Country rules and consent                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The stored rules, with any admin override, joined to how many prospects each
 * country actually has. Read from the database rather than the code constant so
 * counsel can open a market without a deploy.
 */
export async function listCountryRules(): Promise<CountryRuleRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.*, COALESCE(c.n, 0)::int AS count
    FROM outreach_country_rules r
    LEFT JOIN (
      SELECT upper(country) AS code, COUNT(*) AS n FROM prospects GROUP BY upper(country)
    ) c ON c.code = r.country_code
    ORDER BY COALESCE(c.n, 0) DESC, r.country_name ASC
  `;
  return rows.map((row) => ({
    countryCode: row.country_code as string,
    countryName: (row.country_name as string) ?? "",
    dialCode: (row.dial_code as string) ?? "",
    currency: (row.currency as string) ?? "",
    rule: (row.rule as CountryRuleRow["rule"]) ?? "review_required",
    note: (row.note as string) ?? "",
    reviewedAt: row.reviewed_at ? isoDate(row.reviewed_at as string) : null,
    count: Number(row.count ?? 0),
  }));
}

/** A map of country code → rule, for the send loop so it does not query per
 * prospect. */
export async function countryRuleMap(): Promise<Record<string, CountryRuleRow["rule"]>> {
  const sql = getSql();
  const rows = await sql`SELECT country_code, rule FROM outreach_country_rules`;
  const map: Record<string, CountryRuleRow["rule"]> = {};
  for (const row of rows) map[(row.country_code as string).toUpperCase()] = row.rule as CountryRuleRow["rule"];
  return map;
}

/** Records a market as reviewed at a given rule — how a country opens. */
export async function setCountryRule(
  countryCode: string,
  rule: CountryRuleRow["rule"],
  note: string,
  adminUserId: string | null,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO outreach_country_rules (country_code, rule, note, reviewed_at, reviewed_by)
    VALUES (${countryCode.toUpperCase()}, ${rule}, ${note}, now(), ${adminUserId})
    ON CONFLICT (country_code) DO UPDATE SET
      rule = excluded.rule,
      note = excluded.note,
      reviewed_at = now(),
      reviewed_by = excluded.reviewed_by,
      updated_at = now()
  `;
}

/**
 * Records that a business agreed to be contacted.
 *
 * This is the one lawful route into an opt-in market, so it stores when and
 * how — "they replied asking us to stop using their old website" is the kind of
 * note that stands up; a bare boolean would not.
 */
export async function recordConsent(prospectId: string, note: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospects SET
      consent_at = now(),
      consent_note = ${note.slice(0, 500)},
      blocked_reason = '',
      updated_at = now()
    WHERE id = ${prospectId}
  `;
}

export async function clearConsent(prospectId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE prospects SET consent_at = NULL, consent_note = '', updated_at = now() WHERE id = ${prospectId}
  `;
}

/** Records why a send was refused, so the audit trail is not just a toast. */
export async function recordBlockedReason(prospectId: string, reason: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE prospects SET blocked_reason = ${reason.slice(0, 500)}, updated_at = now() WHERE id = ${prospectId}`;
}

/* -------------------------------------------------------------------------- */
/* Unsubscribe                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Suppresses a business by its token. Returns the name so the confirmation
 * page can say what was done — and returns null for an unknown token rather
 * than confirming that some other business exists.
 */
export async function suppressByToken(token: string): Promise<{ businessName: string } | null> {
  if (!token.trim()) return null;
  const sql = getSql();
  const rows = await sql`
    UPDATE prospects SET
      suppressed = true,
      status = 'suppressed',
      updated_at = now()
    WHERE unsubscribe_token = ${token.trim()}
    RETURNING business_name
  `;
  return rows[0] ? { businessName: rows[0].business_name as string } : null;
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
/* -------------------------------------------------------------------------- */

export async function getProspectStats(): Promise<ProspectStats> {
  const sql = getSql();
  const [counts, sentToday, settings] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE website_status = 'unaudited')::int AS unaudited,
        COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified,
        COUNT(*) FILTER (WHERE site_built_at IS NOT NULL)::int AS sites_built,
        COUNT(*) FILTER (WHERE status IN ('contacted', 'replied', 'converted'))::int AS contacted,
        COUNT(*) FILTER (WHERE status = 'replied')::int AS replied,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
        COUNT(*) FILTER (WHERE suppressed = true)::int AS suppressed,
        COUNT(*) FILTER (WHERE consent_at IS NULL AND upper(country) IN ('ZA','EG','MA','KE','GH'))::int AS needs_consent,
        COUNT(*) FILTER (WHERE upper(country) NOT IN (SELECT upper(country_code) FROM outreach_country_rules)
                            OR upper(country) IN (SELECT upper(country_code) FROM outreach_country_rules WHERE rule IN ('blocked','review_required')))::int AS blocked_by_country
      FROM prospects
    `,
    countSentToday(),
    getOutreachSettings(),
  ]);
  const row = (counts[0] ?? {}) as Record<string, unknown>;
  return {
    total: Number(row.total ?? 0),
    unaudited: Number(row.unaudited ?? 0),
    qualified: Number(row.qualified ?? 0),
    sitesBuilt: Number(row.sites_built ?? 0),
    contacted: Number(row.contacted ?? 0),
    replied: Number(row.replied ?? 0),
    converted: Number(row.converted ?? 0),
    suppressed: Number(row.suppressed ?? 0),
    sentToday,
    dailyCap: settings.dailySendCap,
    blockedByCountry: Number(row.blocked_by_country ?? 0),
    needsConsent: Number(row.needs_consent ?? 0),
  };
}
