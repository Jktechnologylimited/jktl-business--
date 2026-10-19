import type { AuditResult, OutreachSettings, Prospect } from "./types";

/**
 * The outreach email.
 *
 * Personalisation here is not "Hi {FirstName}" — it is that the email names the
 * business, names us, links to a website that already exists and carries their
 * name and city, and lists what is actually wrong with the one they have. A
 * cold email that could not have been sent to anybody else is the whole point.
 *
 * The subject always carries both business names, because that is what makes
 * it obviously not a mass blast: `{their_business} — {my_business} built you a new
 * website` reads as a specific statement of fact about them, and it happens to
 * be true — the site is live by the time this sends.
 *
 * Composition is pure and dependency-free so the exact wording, the
 * unsubscribe link and the audit lines are all unit tested. Nothing here
 * invents a claim: the audit findings come from the audit that ran, and if
 * there is no audited site, the copy says so rather than inventing a fault.
 */

export interface OutreachContext {
  prospect: Pick<Prospect, "businessName" | "city" | "state" | "website" | "category" | "niche" | "unsubscribeToken">;
  audit: AuditResult | null;
  siteUrl: string;
  /** Their business name as it will appear in the subject and greeting. */
  theirBusiness: string;
  myBusiness: string;
  includeAudit: boolean;
  calendarLink: string;
  /** Admin-editable, from `outreach_settings.subject_template`. */
  subjectTemplate: string;
  unsubscribeUrl: string;
  /** Where we found them — stated plainly, because "how did you get my email"
   * is the first question a good prospect asks. */
  sourceNote: string;
}

export interface OutreachEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Fills the subject template. Unknown placeholders are stripped rather than
 * left visible, and the result is whitespace-normalised, because a subject
 * line reads oddly with a double space where a missing city was.
 */
export function renderSubject(template: string, vars: { theirBusiness: string; myBusiness: string; city?: string }): string {
  const filled = template
    .split("{their_business}")
    .join(vars.theirBusiness)
    .split("{my_business}")
    .join(vars.myBusiness)
    .split("{city}")
    .join(vars.city ?? "")
    .replace(/\{[a-z_]+\}/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
  return filled || `${vars.myBusiness} built ${vars.theirBusiness} a new website`;
}

/** A short, human list of what is wrong — at most three things, because a
 * list of eight reads as an attack rather than a helpful observation. */
export function auditHighlights(audit: AuditResult | null): string[] {
  // Nothing to list when there is no site: the opening sentence already says
  // so, and repeating it as a complaint would read as padding.
  if (!audit || audit.status === "none" || audit.status === "good" || audit.status === "ok") return [];
  if (!audit.findings.length) return [];
  return audit.findings
    .filter((f) => f.weight >= 8)
    .slice(0, 3)
    .map((f) => f.label);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function composeOutreachEmail(ctx: OutreachContext): OutreachEmail {
  const their = ctx.theirBusiness || ctx.prospect.businessName;
  const city = ctx.prospect.city || ctx.prospect.state;
  const where = city ? ` in ${city}` : "";
  const highlights = ctx.includeAudit ? auditHighlights(ctx.audit) : [];
  const hadNoSite = ctx.audit?.status === "none" || !ctx.prospect.website;

  const subject = renderSubject(ctx.subjectTemplate, { theirBusiness: their, myBusiness: ctx.myBusiness, city });

  const intro = hadNoSite
    ? `We came across ${their}${where} on Google Maps and noticed there was no website listed — so we built you one.`
    : `We came across ${their}${where} on Google Maps, had a look at your website, and thought it could be doing more for you. So we built you a new one.`;

  const auditBlock = highlights.length
    ? `A few things we noticed on the site you have now:`
    : "";

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#12151b;line-height:1.55">
  <p>Hi ${escapeHtml(their)} team,</p>

  <p>${escapeHtml(intro)}</p>

  <p style="margin:18px 0">
    <a href="${escapeHtml(ctx.siteUrl)}" style="background:#0f6e5c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">See your new website</a>
  </p>
  <p style="font-size:13px;color:#5b6470;margin-top:-6px">${escapeHtml(ctx.siteUrl)}</p>

  <p>It already has your name, your location and your services on it, it works properly on a phone, and patients can send you a WhatsApp message or call you with one tap. Nothing to install, nothing to pay to look at it.</p>

  ${
    auditBlock
      ? `<p style="margin-top:20px">${escapeHtml(auditBlock)}</p>
  <ul style="padding-left:20px;color:#3b4451">
    ${highlights.map((h) => `<li style="margin-bottom:6px">${escapeHtml(h)}</li>`).join("\n    ")}
  </ul>`
      : ""
  }

  <p>${
    ctx.calendarLink
      ? `If you would like it, or want changes before deciding, reply to this email or pick a time here: <a href="${escapeHtml(ctx.calendarLink)}">${escapeHtml(ctx.calendarLink)}</a>.`
      : `If you would like it, or want changes before deciding, just reply to this email.`
  }</p>

  <p>— ${escapeHtml(ctx.myBusiness)}</p>

  <hr style="border:none;border-top:1px solid #e4e7eb;margin:24px 0" />
  <p style="font-size:12px;color:#7b838d">
    ${escapeHtml(ctx.sourceNote)}<br/>
    You are receiving this once, as a business listed publicly on Google Maps. If you would rather not hear from us again, <a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#7b838d">unsubscribe here</a> and we will not contact you again.
  </p>
</div>`;

  const text = [
    `Hi ${their} team,`,
    ``,
    intro,
    ``,
    `See your new website: ${ctx.siteUrl}`,
    ``,
    `It already has your name, your location and your services on it, it works properly on a phone, and patients can send you a WhatsApp message or call you with one tap.`,
    ...(highlights.length ? [``, auditBlock, ...highlights.map((h) => `- ${h}`)] : []),
    ``,
    ctx.calendarLink
      ? `If you would like it, or want changes before deciding, reply to this email or pick a time: ${ctx.calendarLink}`
      : `If you would like it, or want changes before deciding, just reply to this email.`,
    ``,
    `— ${ctx.myBusiness}`,
    ``,
    ctx.sourceNote,
    `You are receiving this once, as a business listed publicly on Google Maps. Unsubscribe: ${ctx.unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/**
 * The unsubscribe link. The token is random per prospect and the only thing the
 * URL carries — no email address in a query string, and nothing that would let
 * someone unsubscribe a business that isn't theirs by guessing a name.
 */
export function unsubscribeUrlFor(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The line that answers "how did you get my email", before anyone has to ask. */
export function sourceNoteFor(myBusiness: string): string {
  return `You are listed publicly on Google Maps, and ${myBusiness} helps local businesses get found and booked online.`;
}

/**
 * The subject line.
 *
 * **Their name first, then ours** — "{their business} — {my business} built you
 * a new website". A recipient scanning their inbox sees their own business name,
 * which is what makes them open it; a subject that leads with the sender reads as
 * an advert and gets deleted unread. The em dash is deliberate: it survives
 * being truncated in a mobile preview better than a colon or a hyphen.
 */
export const DEFAULT_SUBJECT_TEMPLATE = "{their_business} — {my_business} built you a new website";

export function resolveSettings(row: Partial<OutreachSettings> | null): OutreachSettings {
  return {
    senderBusinessName: row?.senderBusinessName || "JKTL Business",
    fromEmail: row?.fromEmail || "",
    replyTo: row?.replyTo || "",
    subjectTemplate: row?.subjectTemplate || DEFAULT_SUBJECT_TEMPLATE,
    dailySendCap: row?.dailySendCap && row.dailySendCap > 0 ? row.dailySendCap : 40,
    includeAudit: row?.includeAudit ?? true,
    calendarLink: row?.calendarLink || "",
  };
}
