/**
 * The onboarding email for an existing JKTL client.
 *
 * These are not cold leads. They already paid for a custom website and/or business
 * email, so the email that works is short and factual: your account exists, here is
 * how to get into it. No pitch, no "we noticed your website…" — they bought that
 * website from us, and telling them it is poor would be an insult they paid for.
 *
 * Pure, so the copy that goes out to paying clients is unit tested rather than
 * assembled inline at a call site.
 */

export interface ClientInviteContext {
  /** Their business name, as they know it. */
  businessName: string;
  /** Our business name, from outreach settings. */
  myBusiness: string;
  /** One-time link that lets them set their password. */
  inviteUrl: string;
  /** How long the link works, in days, for the copy. */
  expiresInDays: number;
  /** The business email we provisioned, if any. */
  businessEmail: string;
  /** Their existing custom website, if any. */
  customWebsite: string;
}

/**
 * Subject: their business first, then ours.
 *
 * Same rule as the cold sequence — a recipient scanning an inbox stops at their own
 * name — but the verb is different: this is "is ready", not "built you".
 */
export function clientInviteSubject(ctx: Pick<ClientInviteContext, "businessName" | "myBusiness">): string {
  return `${ctx.businessName} — your ${ctx.myBusiness} account is ready`;
}

export function clientInviteText(ctx: ClientInviteContext): string {
  const lines = [
    `Hi ${ctx.businessName},`,
    ``,
    `Your ${ctx.myBusiness} account has been created.`,
  ];

  if (ctx.customWebsite) lines.push(``, `Your website stays where it is — ${ctx.customWebsite}.`);

  lines.push(
    ``,
    `Set your password here:`,
    ctx.inviteUrl,
    ``,
    `That link works for ${ctx.expiresInDays} days, and once.`,
  );

  if (ctx.businessEmail) {
    lines.push(``, `We set up ${ctx.businessEmail} for you as your business address.`);
  }

  lines.push(
    ``,
    `Inside you will find your customers, bookings, invoices and a place to take payments,`,
    `plus the AI receptionist that answers the calls you cannot.`,
    ``,
    `Any trouble signing in, just reply to this email.`,
    ``,
    `— ${ctx.myBusiness}`,
  );

  return lines.join("\n");
}

export function clientInviteHtml(ctx: ClientInviteContext): string {
  const emailLine = ctx.businessEmail
    ? `<p style="font-size:13px;color:#5b6470">We set up <strong>${ctx.businessEmail}</strong> for you as your business address.</p>`
    : "";
  const siteLine = ctx.customWebsite
    ? `<p style="font-size:13px;color:#5b6470">Your website stays where it is — <a href="${ctx.customWebsite}" style="color:#0f6e5c">${ctx.customWebsite}</a>.</p>`
    : "";

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#12151b">
  <div style="border:1px solid #e4e7eb;border-radius:12px;padding:24px">
    <p style="margin:0 0 14px;font-size:16px"><strong>Your account is ready</strong></p>
    <p>Hi ${ctx.businessName},</p>
    <p>Your ${ctx.myBusiness} account has been created.</p>
    ${siteLine}
    <p style="margin:22px 0">
      <a href="${ctx.inviteUrl}" style="background:#0f6e5c;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Set your password</a>
    </p>
    <p style="font-size:13px;color:#5b6470">That link works for ${ctx.expiresInDays} days, and once.</p>
    ${emailLine}
    <p style="font-size:13px;color:#5b6470">Inside you will find your customers, bookings, invoices and a place to take payments — plus the AI receptionist that answers the calls you cannot.</p>
    <p style="font-size:13px;color:#5b6470">Any trouble signing in, just reply to this email.</p>
    <p style="margin:18px 0 0">— ${ctx.myBusiness}</p>
  </div>
</div>`;
}
