"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import { getSql } from "@/lib/db/client";
import { validateProspectEmails } from "@/lib/prospects/validate-emails";
import {
  advanceSiteBuildJob,
  cancelSiteBuildJob,
  getRunningSiteBuildJob,
  listSiteBuildFailures,
  listSiteBuildJobs,
  startSiteBuildJob,
  type SiteBuildJob,
} from "@/lib/prospects/site-batch";
import {
  clearConsent,
  countSentToday,
  countryRuleMap,
  finishRun,
  getOutreachSettings,
  getProspect,
  getProspectStats,
  importProspects,
  listOutreachCandidates,
  listProspects,
  listProspectsNeedingAudit,
  listRuns,
  recordAudit,
  excludeExistingCustomers,
  listCountryRules,
  recordBlockedReason,
  recordConsent,
  recordOutreach,
  setCountryRule,
  setProspectStatus,
  startRun,
  suppressByToken,
  updateOutreachSettings,
} from "@/lib/db/prospects";
import { auditWebsite, isQualifiedLead, scoreWebsite } from "@/lib/prospects/audit";
import { decideOutreach, normalizeCountryCode } from "@/lib/prospects/jurisdictions";
import { dedupeLeads, fetchApifyLeads, fetchOutscraperLeads, inferNiche, mapApifyPlace, mapCsvRecord, mapOutscraperRow } from "@/lib/prospects/providers";
import { buildOneSite } from "@/lib/prospects/build-site";
import { isMessagingConfigured, purchaseNumber, releaseNumber, searchAvailableNumbers } from "@/lib/twilio";
import { composeOutreachEmail, sourceNoteFor, unsubscribeUrlFor } from "@/lib/prospects/outreach";
import { sendProspectOutreachEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { CountryRuleRow, OutreachSettings, Prospect, ProspectInput, ProspectRun, ProspectStats } from "@/lib/prospects/types";

/**
 * Admin actions for the lead engine. Every one starts with
 * `requireAdminSession()` — this is platform-level data and platform-level
 * spending (scraping credits, sending reputation), and no business account
 * should be able to reach any of it.
 *
 * The pipeline is deliberately four separate, human-triggered steps rather
 * than one button:
 *
 *   1. `importLeadsAction`   — pull businesses from a source
 *   2. `auditLeadsAction`    — find out which have no site or a poor one
 *   3. `buildSitesAction`    — generate and publish a tailored site per lead
 *   4. `sendOutreachAction`  — email them, capped, one at a time or in a batch
 *
 * A single "do everything" button would mean unread emails going out at
 * machine speed to real businesses under JKTL's name. The review step between
 * 3 and 4 is the point.
 */

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://${root}`;
}

/* -------------------------------------------------------------------------- */
/* 1. Import                                                                  */
/* -------------------------------------------------------------------------- */

export interface ImportLeadsInput {
  source: "apify" | "outscraper" | "csv";
  /** The niche query, e.g. "men's health clinic". */
  query: string;
  /** "Lekki Phase 1, Lagos". */
  location: string;
  limit: number;
  /** CSV text, when source is csv. */
  csv?: string;
  /** The affluent area this search covers, when it came from the curated list.
   * Recorded so conversion can be reported per area rather than per ad-hoc
   * search string. */
  searchArea?: string;
}

export interface ImportLeadsResult {
  runId: string;
  found: number;
  imported: number;
  duplicates: number;
  /** Leads skipped because they are already JKTL customers. */
  excluded: number;
  detail: string;
}

export async function importLeadsAction(input: ImportLeadsInput): Promise<ActionResult<ImportLeadsResult>> {
  let runId = "";
  try {
    const admin = await requireAdminSession();

    const query = input.query.trim();
    const location = input.location.trim();
    if (!query) return { ok: false, error: "Enter what to search for, e.g. \"men's health clinic\"." };
    // One synchronous run. Apify can return far more, but the request would time
    // out long before it arrived — so scale comes from running the
    // area × niche matrix across days, not from one enormous scrape. 200 is
    // roughly the most that reliably returns inside the provider timeout.
    const limit = Math.min(Math.max(Math.round(input.limit) || 40, 1), 200);
    const niche = inferNiche(query, query) || "";

    runId = await startRun({ source: input.source, niche, query, location, adminUserId: admin.id });

    let inputs: ProspectInput[] = [];

    if (input.source === "csv") {
      const { default: Papa } = await import("papaparse");
      const parsed = Papa.parse<Record<string, unknown>>(input.csv ?? "", { header: true, skipEmptyLines: true });
      inputs = (parsed.data ?? [])
        .map((row) => mapCsvRecord(row, query))
        .filter((row): row is ProspectInput => row !== null);
    } else if (input.source === "apify") {
      const token = process.env.APIFY_TOKEN;
      if (!token) {
        await finishRun(runId, { status: "failed", error: "APIFY_TOKEN is not configured." });
        return { ok: false, error: "APIFY_TOKEN is not configured. Add it to the environment, or import a CSV instead." };
      }
      const items = await fetchApifyLeads({ token, query, location, limit });
      inputs = items
        .map((item) => mapApifyPlace(item as never, query))
        .filter((row): row is ProspectInput => row !== null);
    } else {
      const apiKey = process.env.OUTSCRAPER_API_KEY;
      if (!apiKey) {
        await finishRun(runId, { status: "failed", error: "OUTSCRAPER_API_KEY is not configured." });
        return { ok: false, error: "OUTSCRAPER_API_KEY is not configured. Add it to the environment, or import a CSV instead." };
      }
      const rows = await fetchOutscraperLeads({ apiKey, query, location, limit });
      inputs = rows
        .map((row) => mapOutscraperRow(row, query))
        .filter((row): row is ProspectInput => row !== null);
    }

    const { unique, duplicates: withinBatch } = dedupeLeads(inputs);
    const { imported, duplicates } = await importProspects(unique, input.searchArea?.trim() ?? "");

    // Never cold-email an existing customer with "we built you a website" —
    // or worse, tell them their website is poor when we built it. Runs on every
    // import, and records why.
    const excluded = await excludeExistingCustomers();

    // Clean the list before anybody emails it. Runs on the newest rows so a
    // large import becomes sendable in waves rather than all at the end.
    const validation = await validateProspectEmails(1000);

    const totalDuplicates = duplicates + withinBatch;

    await finishRun(runId, { status: "ok", found: inputs.length, imported, duplicates: totalDuplicates });
    revalidatePath("/admin/prospects");

    const withEmail = unique.filter((u) => u.email).length;
    return {
      ok: true,
      data: {
        runId,
        found: inputs.length,
        imported,
        duplicates: totalDuplicates,
        excluded,
        detail: `${imported} new ${imported === 1 ? "business" : "businesses"} imported, ${totalDuplicates} already had${
          excluded > 0 ? `, and ${excluded} skipped as existing customers` : ""
        }. ${withEmail ? `${withEmail} came with an email address` : "None came with an email address"}${
          validation.checked > 0
            ? `; ${validation.checked} checked — ${validation.valid} valid, ${validation.risky} shared inboxes, ${validation.invalid} unusable`
            : ""
        }.`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    if (runId) await finishRun(runId, { status: "failed", error: message }).catch(() => undefined);
    console.error(err);
    return { ok: false, error: message };
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Audit                                                                   */
/* -------------------------------------------------------------------------- */

export interface AuditLeadsResult {
  audited: number;
  qualified: number;
  rejected: number;
  breakdown: Record<string, number>;
}

/** Audits up to `limit` unaudited prospects, six at a time. Sequential would
 * take minutes on a large import; unlimited concurrency would look like an
 * attack to the sites being checked. */
export async function auditLeadsAction(limit = 25): Promise<ActionResult<AuditLeadsResult>> {
  try {
    await requireAdminSession();
    const batch = await listProspectsNeedingAudit(Math.min(Math.max(limit, 1), 60));
    if (batch.length === 0) return { ok: true, data: { audited: 0, qualified: 0, rejected: 0, breakdown: {} } };

    const breakdown: Record<string, number> = {};
    let qualified = 0;
    let rejected = 0;
    const queue = [...batch];

    async function worker() {
      for (;;) {
        const prospect = queue.shift();
        if (!prospect) return;
        // No website listed at all: nothing to fetch, and the best possible
        // answer, so it is scored without a network call.
        const result = prospect.website
          ? await auditWebsite(prospect.website)
          : scoreWebsite({
              url: "",
              reachable: false,
              statusCode: null,
              https: false,
              finalUrl: "",
              loadMs: null,
              bytes: 0,
              hasViewport: false,
              title: "",
              hasMetaDescription: false,
              hasOpenGraph: false,
              scriptCount: 0,
              hasBookingCue: false,
              hasPhoneCue: false,
              platform: "unknown",
              parked: false,
            });

        await recordAudit(prospect.id, {
          status: result.status,
          score: result.score,
          findings: result.findings,
          qualified: isQualifiedLead(result),
        });
        breakdown[result.status] = (breakdown[result.status] ?? 0) + 1;
        if (isQualifiedLead(result)) qualified += 1;
        else rejected += 1;
      }
    }

    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

    revalidatePath("/admin/prospects");
    return { ok: true, data: { audited: batch.length, qualified, rejected, breakdown } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "The audit run failed." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Generate sites                                                          */
/* -------------------------------------------------------------------------- */

export interface BuildSitesResult {
  built: number;
  skipped: number;
  sites: Array<{ businessName: string; url: string; contentScore: number; contentGaps: string[] }>;
}

/**
 * Creates a real, published JKTL site for each qualified lead.
 *
 * "Real" is the important word: it is an ordinary organization with a business
 * profile, services and a public subdomain, exactly like a paying customer's,
 * marked `is_prospect` so it stays out of customer counts and so the site
 * renders a preview notice and stays out of search engines until someone
 * claims it.
 */
export async function buildSitesAction(limit = 5): Promise<ActionResult<BuildSitesResult>> {
  try {
    await requireAdminSession();

    const candidates = (await listProspects({ status: "qualified", limit: Math.min(Math.max(limit, 1), 20) })).filter(
      (p) => !p.siteOrganizationId && isQualifiedLead({ status: p.websiteStatus, score: p.websiteScore ?? 0, findings: p.auditFindings, summary: "" }),
    );

    const sites: Array<{ businessName: string; url: string; contentScore: number; contentGaps: string[] }> = [];
    let skipped = 0;

    for (const prospect of candidates) {
      // One implementation for both paths: a site built by hand must be identical
      // to one built by the batch job, or the admin ends up with two subtly
      // different products and no way to tell which a business received.
      const outcome = await buildOneSite(prospect);
      if (!outcome.ok) {
        skipped += 1;
        continue;
      }
      sites.push({
        businessName: prospect.businessName,
        url: outcome.url,
        contentScore: outcome.contentScore,
        contentGaps: outcome.contentGaps,
      });
    }

    revalidatePath("/admin/prospects");
    return { ok: true, data: { built: sites.length, skipped, sites } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not build those sites." };
  }
}

export interface SendOutreachResult {
  attempted: number;
  sent: number;
  failed: number;
  /** True when the daily cap stopped the run before it started. */
  cappedOut: boolean;
  sentTo: Array<{ businessName: string; email: string; subject: string }>;
  errors: string[];
}

export async function sendOutreachAction(prospectIds: string[] | null, limit = 10): Promise<ActionResult<SendOutreachResult>> {
  try {
    const admin = await requireAdminSession();
    const settings = await getOutreachSettings();
    const sentSoFar = await countSentToday();
    const remaining = Math.max(0, settings.dailySendCap - sentSoFar);

    if (remaining === 0) {
      return {
        ok: true,
        data: {
          attempted: 0,
          sent: 0,
          failed: 0,
          cappedOut: true,
          sentTo: [],
          errors: [`Daily cap of ${settings.dailySendCap} already reached. Nothing was sent.`],
        },
      };
    }

    const targets: Prospect[] = prospectIds?.length
      ? (await Promise.all(prospectIds.slice(0, remaining).map((id) => getProspect(id)))).filter((p): p is Prospect => p !== null)
      : await listOutreachCandidates(Math.min(remaining, Math.max(1, Math.round(limit))));

    // Country rules, loaded once: an admin override from the database wins over
    // the conservative code default, and a country we cannot identify is
    // refused rather than treated as anywhere.
    const rules = await countryRuleMap();

    const sentTo: SendOutreachResult["sentTo"] = [];
    const errors: string[] = [];
    let sent = 0;
    let failed = 0;

    for (const prospect of targets) {
      if (prospect.suppressed) {
        errors.push(`${prospect.businessName} has unsubscribed — skipped.`);
        continue;
      }

      // The jurisdiction gate. This is the one guard in the pipeline that
      // exists to keep the company out of trouble rather than to protect a
      // mailbox, so it is enforced here rather than surfaced as a warning in
      // the UI and left to the operator.
      const decision = decideOutreach({
        country: prospect.country,
        consentAt: prospect.consentAt,
        overrideRule: rules[(prospect.country || "").toUpperCase()],
      });
      if (!decision.allowed) {
        errors.push(`${prospect.businessName}: ${decision.reason}`);
        await recordBlockedReason(prospect.id, decision.reason);
        continue;
      }
      if (!prospect.email.includes("@")) {
        errors.push(`${prospect.businessName} has no email address — add one first.`);
        continue;
      }
      /**
       * Never send to an address known bad. A hard bounce is not a wasted email:
       * it is a mark against the sending domain, and enough of them take the
       * transactional mail down with them. Unknown is allowed through, because a
       * lead should not be discarded merely for not having been checked yet.
       */
      if (prospect.emailStatus === "invalid") {
        errors.push(`${prospect.businessName}: the email address failed validation — not sent.`);
        continue;
      }
      if (!prospect.siteSubdomain) {
        errors.push(`${prospect.businessName} has no site yet — build one before emailing.`);
        continue;
      }

      const audit = prospect.auditFindings.length
        ? {
            status: prospect.websiteStatus,
            score: prospect.websiteScore ?? 0,
            findings: prospect.auditFindings,
            summary: "",
          }
        : null;

      const email = composeOutreachEmail({
        prospect,
        audit,
        siteUrl: `${appOrigin()}/sites/${prospect.siteSubdomain}`,
        theirBusiness: prospect.businessName,
        myBusiness: settings.senderBusinessName,
        includeAudit: settings.includeAudit,
        calendarLink: settings.calendarLink,
        subjectTemplate: settings.subjectTemplate,
        unsubscribeUrl: unsubscribeUrlFor(appOrigin(), prospect.unsubscribeToken),
        sourceNote: sourceNoteFor(settings.senderBusinessName),
      });

      const result = await sendProspectOutreachEmail({
        to: prospect.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: settings.replyTo || undefined,
      });

      if (result.ok) {
        sent += 1;
        sentTo.push({ businessName: prospect.businessName, email: prospect.email, subject: email.subject });
        await recordOutreach({
          prospectId: prospect.id,
          toEmail: prospect.email,
          subject: email.subject,
          body: email.text,
          status: "sent",
          adminUserId: admin.id,
        });
      } else {
        failed += 1;
        errors.push(`${prospect.businessName}: ${result.error}`);
        await recordOutreach({
          prospectId: prospect.id,
          toEmail: prospect.email,
          subject: email.subject,
          body: email.text,
          status: "failed",
          error: result.error,
          adminUserId: admin.id,
        });
      }
    }

    revalidatePath("/admin/prospects");
    return {
      ok: true,
      data: {
        attempted: targets.length,
        sent,
        failed,
        cappedOut: sentSoFar + sent >= settings.dailySendCap,
        sentTo,
        errors,
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "The outreach run failed." };
  }
}

/* -------------------------------------------------------------------------- */
/* Bulk site generation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Starts a job to generate sites for every qualified lead without one.
 *
 * Returns as soon as the work list is recorded rather than building anything, so
 * the admin sees a progress bar instead of a spinner that times out. A cron then
 * advances it — see `/api/cron/build-sites`.
 */
export async function startSiteBuildJobAction(params: { limit?: number; onlyWithPhotos?: boolean } = {}): Promise<ActionResult<SiteBuildJob>> {
  try {
    await requireAdminSession();
    const job = await startSiteBuildJob(params);
    revalidatePath("/admin/prospects");
    return { ok: true, data: job };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not start the site build." };
  }
}

/** Builds the next slice, for an admin who would rather not wait for the cron. */
export async function advanceSiteBuildJobAction(jobId: string, batchSize = 6): Promise<ActionResult<SiteBuildJob>> {
  try {
    await requireAdminSession();
    const job = await advanceSiteBuildJob(jobId, batchSize);
    if (!job) return { ok: false, error: "That job no longer exists." };
    revalidatePath("/admin/prospects");
    return { ok: true, data: job };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not advance the site build." };
  }
}

export async function getSiteBuildJobAction(): Promise<
  ActionResult<{ running: SiteBuildJob | null; jobs: SiteBuildJob[]; failures: Array<{ businessName: string; status: string; error: string; subdomain: string }> }>
> {
  try {
    await requireAdminSession();
    const [running, jobs] = await Promise.all([getRunningSiteBuildJob(), listSiteBuildJobs(6)]);
    const latest = jobs[0] ?? running;
    const failures = latest ? await listSiteBuildFailures(latest.id, 25) : [];
    return { ok: true, data: { running, jobs, failures } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not load the build progress." };
  }
}

export async function cancelSiteBuildJobAction(jobId: string): Promise<ActionResult<null>> {
  try {
    await requireAdminSession();
    await cancelSiteBuildJob(jobId);
    revalidatePath("/admin/prospects");
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not cancel that job." };
  }
}

/* -------------------------------------------------------------------------- */
/* Dedicated numbers (Twilio)                                                 */
/* -------------------------------------------------------------------------- */

/** Where Twilio should send a bought number's calls. The number is useless
 * unless its webhook points here, so it is set at purchase time rather than
 * left as a follow-up somebody forgets. */
function voiceWebhookUrl(): string {
  return `${appOrigin()}/v1/missed-call`;
}

export interface NumberSearchResult {
  numbers: Array<{ phoneNumber: string; locality: string; region: string }>;
}

/**
 * Searches Twilio for a number that looks local to a business.
 *
 * This is what makes "every clinic gets its own line" an operation rather than
 * a support ticket — and it is the only way Option A has anything to bill.
 */
export async function searchNumbersAction(params: { country: string; areaCode?: string; contains?: string }): Promise<ActionResult<NumberSearchResult>> {
  try {
    await requireAdminSession();
    if (!isMessagingConfigured()) return { ok: false, error: "Twilio credentials are not configured." };

    const result = await searchAvailableNumbers({
      country: params.country,
      areaCode: params.areaCode?.trim() || undefined,
      contains: params.contains?.trim() || undefined,
      limit: 15,
    });
    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      data: {
        numbers: result.numbers
          .filter((n) => n.capabilities.voice)
          .map((n) => ({ phoneNumber: n.phoneNumber, locality: n.locality, region: n.region })),
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not search for numbers." };
  }
}

/**
 * Buys a number and attaches it to a business, setting the monthly rental in
 * the same step.
 *
 * The rental is required rather than optional, because a line with no rental is
 * the exact gap this whole change exists to close: JKTL paying for somebody
 * else's number, invisibly.
 */
export async function provisionNumberAction(params: {
  organizationId: string;
  phoneNumber: string;
  rentalNaira: number;
  country: string;
  friendlyName?: string;
}): Promise<ActionResult<{ phoneNumber: string; rentalKobo: number }>> {
  try {
    await requireAdminSession();
    if (!isMessagingConfigured()) return { ok: false, error: "Twilio credentials are not configured." };

    const rentalKobo = Math.round((Number(params.rentalNaira) || 0) * 100);
    if (rentalKobo <= 0) {
      return { ok: false, error: "Set a monthly rental — a line nobody pays for is the problem this fixes." };
    }

    const bought = await purchaseNumber({
      phoneNumber: params.phoneNumber,
      voiceUrl: voiceWebhookUrl(),
      smsUrl: voiceWebhookUrl(),
      friendlyName: params.friendlyName,
    });
    if (!bought.ok) return { ok: false, error: bought.error };

    const sql = getSql();
    await sql`
      UPDATE ai_receptionist_config SET
        voice_number = ${bought.number.phoneNumber},
        line_number_sid = ${bought.number.sid},
        line_status = 'active',
        line_country = ${params.country.toUpperCase()},
        line_rental_kobo_per_month = ${rentalKobo},
        line_provisioned_at = now(),
        line_request_note = '',
        updated_at = now()
      WHERE organization_id = ${params.organizationId}
    `;

    revalidatePath("/admin/prospects");
    return { ok: true, data: { phoneNumber: bought.number.phoneNumber, rentalKobo } };
  } catch (err) {
    console.error(err);
    // The most likely failure by far is the unique index on the number, which
    // means another business already has it.
    const message = err instanceof Error && /voice_number/.test(err.message)
      ? "That number is already assigned to another business."
      : "Could not provision that number.";
    return { ok: false, error: message };
  }
}

/** Gives up a number and stops billing for it. Released at Twilio so it stops
 * costing JKTL anything either. */
export async function releaseNumberAction(organizationId: string): Promise<ActionResult<{ released: boolean }>> {
  try {
    await requireAdminSession();
    const sql = getSql();
    const row = (await sql`SELECT line_number_sid FROM ai_receptionist_config WHERE organization_id = ${organizationId}`)[0];
    const sid = (row?.line_number_sid as string) ?? "";

    if (sid && isMessagingConfigured()) {
      const released = await releaseNumber(sid);
      if (!released.ok) return { ok: false, error: released.error };
    }

    await sql`
      UPDATE ai_receptionist_config SET
        line_status = 'released', line_number_sid = '', line_rental_kobo_per_month = 0, updated_at = now()
      WHERE organization_id = ${organizationId}
    `;
    revalidatePath("/admin/prospects");
    return { ok: true, data: { released: true } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not release that number." };
  }
}

/** Businesses waiting for a line, so ops has a work list rather than an inbox. */
export async function listNumberRequestsAction(): Promise<
  ActionResult<Array<{ organizationId: string; businessName: string; countryCode: string; note: string; requestedAt: string | null }>>
> {
  try {
    await requireAdminSession();
    const sql = getSql();
    const rows = await sql`
      SELECT c.organization_id, bp.display_name, bp.country_code, c.line_request_note, c.line_requested_at
      FROM ai_receptionist_config c
      JOIN business_profiles bp ON bp.organization_id = c.organization_id
      WHERE c.line_status = 'requested'
      ORDER BY c.line_requested_at ASC NULLS LAST
      LIMIT 100
    `;
    return {
      ok: true,
      data: rows.map((row) => ({
        organizationId: row.organization_id as string,
        businessName: (row.display_name as string) ?? "",
        countryCode: (row.country_code as string) ?? "NG",
        note: (row.line_request_note as string) ?? "",
        requestedAt: row.line_requested_at ? new Date(row.line_requested_at as string).toISOString() : null,
      })),
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not load number requests." };
  }
}

/* -------------------------------------------------------------------------- */
/* Small operations                                                           */
/* -------------------------------------------------------------------------- */

export async function setProspectStatusAction(id: string, status: Prospect["status"]): Promise<ActionResult<{ status: string }>> {
  try {
    await requireAdminSession();
    await setProspectStatus(id, status);
    revalidatePath("/admin/prospects");
    return { ok: true, data: { status } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not update that lead." };
  }
}

export async function saveOutreachSettingsAction(input: OutreachSettings): Promise<ActionResult<{ saved: true }>> {
  try {
    await requireAdminSession();
    if (!input.subjectTemplate.includes("{their_business}") && !input.subjectTemplate.includes("{my_business}")) {
      return { ok: false, error: "The subject must include {their_business} or {my_business} — that is what personalises it." };
    }
    if (input.fromEmail && !input.fromEmail.includes("@")) return { ok: false, error: "Enter a valid from address." };
    if (input.dailySendCap < 1 || input.dailySendCap > 500) return { ok: false, error: "Keep the daily cap between 1 and 500." };

    await updateOutreachSettings({ ...input, dailySendCap: Math.round(input.dailySendCap) });
    revalidatePath("/admin/prospects");
    return { ok: true, data: { saved: true } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not save the outreach settings." };
  }
}

export interface ProspectWorkbench {
  prospects: Prospect[];
  stats: ProspectStats;
  settings: OutreachSettings;
  runs: ProspectRun[];
  countries: CountryRuleRow[];
  integrations: { apify: boolean; outscraper: boolean; resend: boolean };
}

/**
 * Records that a business agreed to be contacted — the lawful route into an
 * opt-in market, and the evidence behind it. The note is required because a
 * bare timestamp proves nothing.
 */
export async function recordConsentAction(prospectId: string, note: string): Promise<ActionResult<{ recorded: true }>> {
  try {
    await requireAdminSession();
    const trimmed = note.trim();
    if (trimmed.length < 8) {
      return { ok: false, error: "Describe how they agreed — a note is what makes the consent defensible." };
    }
    await recordConsent(prospectId, trimmed);
    revalidatePath("/admin/prospects");
    return { ok: true, data: { recorded: true } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not record consent." };
  }
}

export async function clearConsentAction(prospectId: string): Promise<ActionResult<{ cleared: true }>> {
  try {
    await requireAdminSession();
    await clearConsent(prospectId);
    revalidatePath("/admin/prospects");
    return { ok: true, data: { cleared: true } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not withdraw consent." };
  }
}

/** Opens (or closes) a market. Every change is attributed to the admin who
 * made it and stamped as reviewed, so "who decided we could email Kenya" has an
 * answer. */
export async function setCountryRuleAction(
  countryCode: string,
  rule: CountryRuleRow["rule"],
  note: string,
): Promise<ActionResult<{ countryCode: string; rule: string }>> {
  try {
    const admin = await requireAdminSession();
    const code = normalizeCountryCode(countryCode);
    if (!code) return { ok: false, error: "Unknown country code." };
    if (note.trim().length < 8) return { ok: false, error: "Add the reason — the statute or the advice you are relying on." };
    await setCountryRule(code, rule, note.trim(), admin.id);
    revalidatePath("/admin/prospects");
    return { ok: true, data: { countryCode: code, rule } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not update that country rule." };
  }
}

export async function getProspectWorkbenchAction(filters: { status?: string; websiteStatus?: string; niche?: string; search?: string } = {}): Promise<
  ActionResult<ProspectWorkbench>
> {
  try {
    await requireAdminSession();
    const [prospects, stats, settings, runs, countries] = await Promise.all([
      listProspects({
        status: (filters.status as Prospect["status"] | "all") ?? "all",
        websiteStatus: (filters.websiteStatus as Prospect["websiteStatus"] | "all") ?? "all",
        niche: filters.niche ?? "all",
        search: filters.search,
        limit: 200,
      }),
      getProspectStats(),
      getOutreachSettings(),
      listRuns(8),
      listCountryRules(),
    ]);

    return {
      ok: true,
      data: {
        prospects,
        stats,
        settings,
        runs,
        countries,
        integrations: {
          apify: Boolean(process.env.APIFY_TOKEN),
          outscraper: Boolean(process.env.OUTSCRAPER_API_KEY),
          resend: Boolean(process.env.RESEND_API_KEY),
        },
      },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not load the lead engine." };
  }
}

/** Preview the exact email a prospect would receive, without sending it — the
 * single most useful thing to check before a batch goes out. */
export async function previewOutreachAction(prospectId: string): Promise<ActionResult<{ subject: string; text: string }>> {
  try {
    await requireAdminSession();
    const prospect = await getProspect(prospectId);
    if (!prospect) return { ok: false, error: "That lead no longer exists." };
    const settings = await getOutreachSettings();
    const audit = prospect.auditFindings.length
      ? { status: prospect.websiteStatus, score: prospect.websiteScore ?? 0, findings: prospect.auditFindings, summary: "" }
      : null;

    const email = composeOutreachEmail({
      prospect,
      audit,
      siteUrl: `${appOrigin()}/sites/${prospect.siteSubdomain || "not-built-yet"}`,
      theirBusiness: prospect.businessName,
      myBusiness: settings.senderBusinessName,
      includeAudit: settings.includeAudit,
      calendarLink: settings.calendarLink,
      subjectTemplate: settings.subjectTemplate,
      unsubscribeUrl: unsubscribeUrlFor(appOrigin(), prospect.unsubscribeToken),
      sourceNote: sourceNoteFor(settings.senderBusinessName),
    });
    return { ok: true, data: { subject: email.subject, text: email.text } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not build the preview." };
  }
}

/** Used by the public unsubscribe page (no admin session — the token is the
 * whole credential, and it can only ever suppress one business). */
export async function unsubscribeProspectAction(token: string): Promise<ActionResult<{ businessName: string }>> {
  try {
    const result = await suppressByToken(token);
    if (!result) return { ok: false, error: "That unsubscribe link is not valid." };
    return { ok: true, data: result };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Could not process that request." };
  }
}
