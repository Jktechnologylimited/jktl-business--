import { Resend } from "resend";
import { formatKobo, formatShortDate, formatTime } from "@/lib/format";

let cached: Resend | null = null;

function getResend(): Resend {
  if (!cached) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set. Add it to .env.local — see .env.example.");
    cached = new Resend(key);
  }
  return cached;
}

const FROM = process.env.RESEND_FROM_EMAIL || "JKTL Business <jktl-business@mail.ibiz.name.ng>";

type EmailResult = { ok: true } | { ok: false; error: string };

/** Every send is wrapped so a failed email never breaks the action that
 * triggered it (a signup should succeed even if the welcome email bounces).
 * Callers fire these without awaiting the result for exactly that reason. */
/**
 * Prospect outreach. Deliberately separate from `send()` above for two
 * reasons: it sends from a dedicated outbound address where one is configured
 * (cold outreach should not share a reputation with transactional mail), and
 * it carries a `reply_to` so a prospect's reply lands in a real inbox.
 *
 * It is also the only sender in this file whose failures are surfaced rather
 * than swallowed — `sendOutreachAction` records the error per prospect, because
 * "why didn't Vitalis get the email" needs an answer.
 */
export async function sendProspectOutreachEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  if (!params.to || !params.to.includes("@")) return { ok: false, error: "No valid recipient email." };
  try {
    const { error } = await getResend().emails.send({
      from: process.env.RESEND_OUTREACH_FROM_EMAIL || FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error." };
  }
}

async function send(to: string, subject: string, html: string, text: string): Promise<EmailResult> {
  if (!to || !to.includes("@")) return { ok: false, error: "No valid recipient email." };
  try {
    const { error } = await getResend().emails.send({ from: FROM, to, subject, html, text });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error." };
  }
}

function wrapper(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#12151b">
    <div style="background:#0f6e5c;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;font-weight:700;font-size:18px">JKTL Business</div>
    <div style="border:1px solid #e4e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">${bodyHtml}</div>
  </div>`;
}

export async function sendWelcomeEmail(to: string, name: string, businessName: string): Promise<EmailResult> {
  const html = wrapper(`
    <p>Hi ${name},</p>
    <p><strong>${businessName}</strong> is now set up on JKTL Business. You can sign in anytime to manage customers, bookings, sales, and more — online or off.</p>
    <p>— The JKTL Business team</p>
  `);
  const text = `Hi ${name},\n\n${businessName} is now set up on JKTL Business.\n\n— The JKTL Business team`;
  return send(to, `Welcome to JKTL Business, ${businessName}!`, html, text);
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
}): Promise<EmailResult> {
  const { to, customerName, businessName, serviceName, startsAt } = params;
  const html = wrapper(`
    <p>Hi ${customerName},</p>
    <p>Your booking with <strong>${businessName}</strong> is confirmed:</p>
    <p style="background:#f5f6f8;border-radius:8px;padding:12px 16px;margin:16px 0">
      ${serviceName}<br/>${formatShortDate(startsAt)} at ${formatTime(startsAt)}
    </p>
    <p>See you then!</p>
  `);
  const text = `Hi ${customerName},\n\nYour booking with ${businessName} is confirmed: ${serviceName} on ${formatShortDate(startsAt)} at ${formatTime(startsAt)}.`;
  return send(to, `Booking confirmed with ${businessName}`, html, text);
}

export async function sendInvoiceEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  totalKobo: number;
  dueDate: string;
  lines: Array<{ description: string; quantity: number; totalKobo: number }>;
  /** Where the customer taps to pay, when the business can take cards. */
  payUrl?: string;
  businessPhone?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}): Promise<EmailResult> {
  const {
    to,
    customerName,
    businessName,
    invoiceNumber,
    totalKobo,
    dueDate,
    lines,
    payUrl,
    businessPhone,
    bankName,
    accountName,
    accountNumber,
  } = params;

  const rows = lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e4e7eb;color:#12151b">${line.description}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e4e7eb;color:#5b6470;text-align:right">${line.quantity}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e4e7eb;color:#12151b;text-align:right;white-space:nowrap">${formatKobo(line.totalKobo)}</td>
      </tr>`,
    )
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#12151b">
  <div style="border:1px solid #e4e7eb;border-radius:14px;overflow:hidden">
    <div style="display:flex;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e4e7eb">
      <div>
        <div style="font-size:16px;font-weight:700">${businessName}</div>
        ${businessPhone ? `<div style="font-size:12px;color:#5b6470">${businessPhone}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:700">Invoice</div>
        <div style="font-size:12px;color:#5b6470">#${invoiceNumber}</div>
      </div>
    </div>

    <div style="padding:20px 24px">
      <p style="margin:0 0 4px">Hi ${customerName || "there"},</p>
      <p style="margin:0;color:#3b4451">Please find invoice <strong>#${invoiceNumber}</strong> from ${businessName} below.</p>

      <table style="width:100%;border-collapse:collapse;margin:18px 0 0;font-size:14px">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:6px;font-size:11px;text-transform:uppercase;color:#7b838d">Description</th>
            <th style="text-align:right;padding-bottom:6px;font-size:11px;text-transform:uppercase;color:#7b838d">Qty</th>
            <th style="text-align:right;padding-bottom:6px;font-size:11px;text-transform:uppercase;color:#7b838d">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px solid #12151b">
        <span style="font-weight:700;font-size:15px">Total due</span>
        <span style="font-weight:700;font-size:15px">${formatKobo(totalKobo)}</span>
      </div>
      <p style="margin:6px 0 0;font-size:13px;color:${new Date(dueDate).getTime() < Date.now() ? "#c0392b" : "#5b6470"}">Due ${formatShortDate(dueDate)}</p>

      ${
        payUrl
          ? `<p style="margin:22px 0 6px">
        <a href="${payUrl}" style="background:#0f6e5c;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Pay ${formatKobo(totalKobo)} now</a>
      </p>
      <p style="margin:0;font-size:12px;color:#7b838d">Card payment, secured by Paystack. ${businessName} is notified the moment it clears.</p>`
          : ""
      }

      ${
        bankName
          ? `<div style="margin-top:20px;background:#f5f6f8;border-radius:10px;padding:12px 16px;font-size:13px;color:#3b4451">
        <strong>Or pay by bank transfer</strong><br/>
        ${accountName} · ${bankName} · ${accountNumber}<br/>
        <span style="font-size:12px;color:#7b838d">Use #${invoiceNumber} as the reference.</span>
      </div>`
          : ""
      }

      <p style="margin:22px 0 0;color:#5b6470;font-size:13px">Any questions, just reply to this email.</p>
      <p style="margin:4px 0 0;font-size:13px">— ${businessName}</p>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#a6adb6;margin-top:14px">Sent with JKTL Business</p>
</div>`;

  const text = [
    `Hi ${customerName || "there"},`,
    ``,
    `Invoice #${invoiceNumber} from ${businessName}`,
    ``,
    ...lines.map((l) => `${l.quantity} x ${l.description} — ${formatKobo(l.totalKobo)}`),
    ``,
    `Total due: ${formatKobo(totalKobo)}`,
    `Due ${formatShortDate(dueDate)}`,
    ...(payUrl ? [``, `Pay now: ${payUrl}`] : []),
    ...(bankName ? [``, `Or transfer to ${accountName} · ${bankName} · ${accountNumber} (reference #${invoiceNumber})`] : []),
    ``,
    `— ${businessName}`,
  ].join("\n");

  return send(to, `Invoice #${invoiceNumber} from ${businessName} — ${formatKobo(totalKobo)}`, html, text);
}

/**
 * The receipt a customer gets the moment they pay.
 *
 * Separate from the "invoice sent" email because it answers a different
 * question — not "what do I owe" but "did it go through, and can I prove it".
 * It leads with the amount and the date, and carries the reference, because
 * that is what a customer quotes when something goes wrong.
 */
export async function sendPaymentReceiptEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  totalKobo: number;
  paidAt: string;
  reference: string;
}): Promise<EmailResult> {
  const { to, customerName, businessName, invoiceNumber, totalKobo, paidAt, reference } = params;
  const html = wrapper(`
    <p style="margin:0 0 12px;font-size:15px"><strong>Payment received — thank you.</strong></p>
    <p>Hi ${customerName || "there"},</p>
    <p>We've received your payment for invoice <strong>#${invoiceNumber}</strong> to ${businessName}.</p>
    <p style="background:#eaf5f1;border-radius:10px;padding:14px 16px;margin:16px 0">
      <span style="font-size:22px;font-weight:700">${formatKobo(totalKobo)}</span><br/>
      <span style="font-size:13px;color:#3b4451">Paid ${formatShortDate(paidAt)}${reference ? ` · Reference ${reference}` : ""}</span>
    </p>
    <p style="font-size:13px;color:#5b6470">Keep this email as your receipt. ${businessName} has been notified that the invoice is settled.</p>
  `);
  const text = `Payment received — thank you.\n\n${formatKobo(totalKobo)} for invoice #${invoiceNumber} to ${businessName}, paid ${formatShortDate(paidAt)}${reference ? ` (reference ${reference})` : ""}. Keep this as your receipt.`;
  return send(to, `Receipt — ${formatKobo(totalKobo)} paid to ${businessName}`, html, text);
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  totalKobo: number;
}): Promise<EmailResult> {
  const { to, customerName, businessName, invoiceNumber, totalKobo } = params;
  const html = wrapper(`
    <p>Hi ${customerName},</p>
    <p>This confirms <strong>${businessName}</strong> received your payment of <strong>${formatKobo(totalKobo)}</strong> for invoice ${invoiceNumber}. Thank you!</p>
  `);
  const text = `Hi ${customerName},\n\nThis confirms ${businessName} received your payment of ${formatKobo(totalKobo)} for invoice ${invoiceNumber}. Thank you!`;
  return send(to, `Payment received — ${invoiceNumber}`, html, text);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<EmailResult> {
  const { to, name, resetUrl } = params;
  const html = wrapper(`
    <p>Hi ${name},</p>
    <p>We got a request to reset your JKTL Business password. This link works for 1 hour:</p>
    <p style="margin:20px 0"><a href="${resetUrl}" style="background:#0f6e5c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
    <p style="font-size:13px;color:#5b6675">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `);
  const text = `Hi ${name},\n\nWe got a request to reset your JKTL Business password. This link works for 1 hour:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;
  return send(to, "Reset your JKTL Business password", html, text);
}

export async function sendNewBookingRequestEmail(params: {
  to: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  requestedAt: string;
}): Promise<EmailResult> {
  const { to, businessName, customerName, customerPhone, serviceName, requestedAt } = params;
  const html = wrapper(`
    <p>Hi,</p>
    <p>Someone just booked through your <strong>${businessName}</strong> website:</p>
    <p style="background:#f5f6f8;border-radius:8px;padding:12px 16px;margin:16px 0">
      ${serviceName}<br/>${formatShortDate(requestedAt)} at ${formatTime(requestedAt)}<br/>
      ${customerName}${customerPhone ? ` · ${customerPhone}` : ""}
    </p>
    <p>It's saved as a pending booking — open JKTL Business to confirm it.</p>
  `);
  const text = `New booking request for ${businessName}: ${serviceName} on ${formatShortDate(requestedAt)} at ${formatTime(requestedAt)} — ${customerName}${customerPhone ? ` (${customerPhone})` : ""}. It's pending in JKTL Business.`;
  return send(to, `New booking request — ${businessName}`, html, text);
}

export async function sendRenewalReminderEmail(params: {
  to: string;
  businessName: string;
  renewalDate: string;
  priceKobo: number;
}): Promise<EmailResult> {  const { to, businessName, renewalDate, priceKobo } = params;
  const html = wrapper(`
    <p>Hi,</p>
    <p>Your JKTL Business plan for <strong>${businessName}</strong> renews on <strong>${formatShortDate(renewalDate)}</strong> (${formatKobo(priceKobo)}/year).</p>
    <p>No action needed if your details are up to date.</p>
  `);
  const text = `Your JKTL Business plan for ${businessName} renews on ${formatShortDate(renewalDate)} (${formatKobo(priceKobo)}/year).`;
  return send(to, `Your plan renews soon — ${businessName}`, html, text);
}

/**
 * Raises a clinical escalation from the AI receptionist to a human at the
 * clinic. Sent when the deterministic triage screen fires, or when the agent
 * itself decides a person needs to take over.
 *
 * Deliberately terse and quiet about content: it names the patient's number
 * and the rule that fired, but does not repeat what the patient wrote. That
 * text is in the console, behind a login — an email is not the place to
 * forward someone's symptoms.
 */
export async function sendEscalationEmail(params: {
  to: string;
  businessName: string;
  patientName: string;
  patientPhone: string;
  reason: string;
  severity: "emergency" | "urgent" | "caution" | "handoff";
  isEmergencyServices: boolean;
}): Promise<EmailResult> {
  const { to, businessName, patientName, patientPhone, reason, severity, isEmergencyServices } = params;
  const urgent = severity === "emergency" || severity === "urgent";
  const who = patientName || patientPhone || "A patient";
  const html = wrapper(`
    <p>${urgent ? "<strong>Urgent:</strong> " : ""}${who} needs a person from ${businessName}.</p>
    <p style="background:#f5f6f8;border-radius:8px;padding:12px 16px;margin:16px 0">
      ${reason}<br/>
      ${patientPhone ? `Phone: ${patientPhone}<br/>` : ""}
      Raised by the AI booking assistant
    </p>
    ${
      isEmergencyServices
        ? "<p>The patient has been told to seek emergency care now and given 112. Please call them to confirm they are safe.</p>"
        : "<p>Open the AI receptionist console to read the conversation and take over.</p>"
    }
  `);
  const text = `${urgent ? "Urgent: " : ""}${who} needs a person from ${businessName}. ${reason}${patientPhone ? ` Phone: ${patientPhone}.` : ""}`;
  return send(to, `${urgent ? "Urgent — " : ""}A patient needs a person — ${businessName}`, html, text);
}

/**
 * The two operational money emails for the AI receptionist, in one function
 * because they share a shape and differ only in copy:
 *
 *   low_balance — the clinic's communication wallet is nearly empty, so the
 *                 assistant is about to start recording calls it cannot
 *                 answer. Sent weekly while the condition holds, which is why
 *                 it says what will happen rather than just what's wrong.
 *   fee_due     — the ₦59,000 monthly platform tier has come due.
 */
export async function sendReceptionistOpsEmail(params: {
  to: string;
  businessName: string;
  kind: "low_balance" | "fee_due";
  amountKobo: number;
  balanceKobo?: number;
  /** Which month the fee covers, and whether it is still an instalment of the
   * ₦650,000 package or the ₦59,000 platform tier. The difference matters to
   * the reader — one is a finite run of six, the other is ongoing — so the
   * email says which it is rather than quoting a single flat "monthly fee". */
  monthIndex?: number;
  isInstalment?: boolean;
}): Promise<EmailResult> {
  const { to, businessName, kind, amountKobo, balanceKobo } = params;

  if (kind === "low_balance") {
    const html = wrapper(`
      <p>Hi,</p>
      <p><strong>${businessName}</strong>'s AI receptionist communication wallet is down to <strong>${formatKobo(balanceKobo ?? 0)}</strong>.</p>
      <p>When it runs out, the assistant stops texting patients back and starts recording the calls it could not answer instead — those calls are not recovered.</p>
      <p>Top up from the AI receptionist console to keep answering missed calls.</p>
      <p>— The JKTL Business team</p>
    `);
    const text = `${businessName}'s communication wallet is down to ${formatKobo(balanceKobo ?? 0)}. Top up in the AI receptionist console to keep answering missed calls.`;
    return send(to, `Communication wallet running low — ${businessName}`, html, text);
  }

  const month = params.monthIndex ? ` for month ${params.monthIndex}` : "";
  const what = params.isInstalment ? "an instalment of your turnkey launch package" : "your monthly platform tier";
  const html = wrapper(`
    <p>Hi,</p>
    <p>${what.charAt(0).toUpperCase()}${what.slice(1)} for <strong>${businessName}</strong> is due${month}: <strong>${formatKobo(amountKobo)}</strong>.</p>
    ${
      params.isInstalment
        ? "<p>This is one of six instalments covering the ₦650,000 turnkey package. Once they finish, the platform tier is ₦59,000 a month. You can cancel at any time — there is no minimum term.</p>"
        : "<p>This covers the assistant, the dashboard, ongoing model updates and live database sync. Your communication wallet is billed separately and stays under your control.</p>"
    }
    <p>— The JKTL Business team</p>
  `);
  const text = `${what} for ${businessName} is due${month}: ${formatKobo(amountKobo)}.`;
  return send(to, `${formatKobo(amountKobo)} due${month} — ${businessName}`, html, text);
}

/**
 * The partner password-reset email.
 *
 * Links **directly to the business app**, not through the marketing domain. The
 * marketing proxy would preserve the `?token=` query string, so a link via
 * jktl.com.ng would work — but a credential in a URL should travel the shortest
 * path possible, and every extra hop is another place it can be logged.
 *
 * Deliberately plain: no marketing, no upsell, one link. This arrives when
 * somebody is already slightly worried about their account, and anything that
 * looks like a campaign in that moment reads as phishing.
 */
export async function sendAffiliatePasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<EmailResult> {
  const { to, name, resetUrl, expiresInMinutes } = params;
  const firstName = name.trim().split(/\s+/)[0] || "there";

  const html = wrapper(`
    <p style="margin:0 0 12px;font-size:15px"><strong>Reset your partner password</strong></p>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset the password on your JKTL Business partner account.</p>
    <p style="margin:22px 0">
      <a href="${resetUrl}" style="background:#0f6e5c;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Set a new password</a>
    </p>
    <p style="font-size:13px;color:#5b6470">This link works for ${expiresInMinutes} minutes, and only once.</p>
    <p style="font-size:13px;color:#5b6470">If you did not ask for this, you can ignore this email — your password has not changed, and nobody can use the link without opening this message.</p>
    <p style="font-size:12px;color:#9aa1a9;margin-top:18px;word-break:break-all">If the button does not work, paste this into your browser:<br/>${resetUrl}</p>
  `);

  const text = [
    `Hi ${firstName},`,
    ``,
    `We received a request to reset the password on your JKTL Business partner account.`,
    ``,
    `Set a new password: ${resetUrl}`,
    ``,
    `This link works for ${expiresInMinutes} minutes, and only once.`,
    `If you did not ask for this, ignore this email — your password has not changed.`,
  ].join("\n");

  return send(to, "Reset your JKTL Business partner password", html, text);
}

/* -------------------------------------------------------------------------- */
/* Partner applications                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Sent when an admin approves a partner.
 *
 * This is the email that was missing, and its absence broke the programme's
 * basic loop: an applicant set a password, their application sat in the admin
 * queue, somebody approved it — and **nobody told them**. From the partner's side
 * they had applied and heard nothing, forever. The programme only worked for
 * people who happened to try signing in on the off-chance.
 *
 * It carries everything they need in one message: where to sign in, which email
 * to use, their referral link, and what they will earn. A partner who has to ask
 * "what was my link again" has already cost more than the email did.
 */
export async function sendAffiliateApprovedEmail(params: {
  to: string;
  name: string;
  signInUrl: string;
  referralLink: string;
  signupBonusKobo: number;
  subscriptionBonusKobo: number;
  recurringMonthlyKobo: number;
  firstYearValueKobo: number;
  payoutDay: number;
}): Promise<EmailResult> {
  const { to, name, signInUrl, referralLink, signupBonusKobo, subscriptionBonusKobo, recurringMonthlyKobo, firstYearValueKobo, payoutDay } = params;
  const firstName = name.trim().split(/\s+/)[0] || "there";

  const tier = (label: string, amount: number) => `
    <tr>
      <td style="padding:7px 0;color:#3b4451">${label}</td>
      <td style="padding:7px 0;text-align:right;font-weight:600;white-space:nowrap">${formatKobo(amount)}</td>
    </tr>`;

  const html = wrapper(`
    <p style="margin:0 0 14px;font-size:16px"><strong>You're approved — welcome to the partner programme.</strong></p>
    <p>Hi ${firstName},</p>
    <p>Your application has been approved. You can sign in right now with the email and password you applied with.</p>

    <p style="margin:20px 0 6px">
      <a href="${signInUrl}" style="background:#0f6e5c;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Sign in to your dashboard</a>
    </p>
    <p style="font-size:13px;color:#5b6470;margin:0">Use <strong>${to}</strong> — the email you applied with.</p>

    <p style="margin:22px 0 6px;font-size:14px"><strong>Your referral link</strong></p>
    <p style="background:#f5f6f8;border-radius:10px;padding:12px 14px;font-size:13px;word-break:break-all;margin:0">${referralLink}</p>
    <p style="font-size:12px;color:#7b838d;margin:6px 0 0">Share this anywhere. Clicks are tracked for 30 days, and a business that comes through it stays yours for as long as they remain a customer.</p>

    <p style="margin:22px 0 8px;font-size:14px"><strong>What one referral is worth</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${tier("When they create an account", signupBonusKobo)}
      ${tier("When they subscribe", subscriptionBonusKobo)}
      ${tier("Every month they stay subscribed", recurringMonthlyKobo)}
      <tr>
        <td style="padding:9px 0;border-top:2px solid #12151b;font-weight:700">First year, per referral</td>
        <td style="padding:9px 0;border-top:2px solid #12151b;text-align:right;font-weight:700;white-space:nowrap">${formatKobo(firstYearValueKobo)}</td>
      </tr>
    </table>
    <p style="font-size:12px;color:#7b838d;margin:8px 0 0">The first payment is shown in your dashboard as soon as your referral creates an account, and becomes withdrawable when they subscribe. Payout requests open from the ${payoutDay}st of each month.</p>

    <p style="margin:22px 0 0;font-size:13px;color:#5b6470">Your dashboard has ready-made messages you can send on WhatsApp, and a playbook if you have never promoted anything before.</p>
    <p style="margin:4px 0 0">— JKTL Business</p>
  `);

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your partner application has been approved. Sign in with the email and password you applied with:`,
    signInUrl,
    ``,
    `Your referral link: ${referralLink}`,
    ``,
    `What one referral is worth:`,
    `  ${formatKobo(signupBonusKobo)} when they create an account`,
    `  ${formatKobo(subscriptionBonusKobo)} when they subscribe`,
    `  ${formatKobo(recurringMonthlyKobo)} every month they stay subscribed`,
    `  ${formatKobo(firstYearValueKobo)} in the first year`,
    ``,
    `Payout requests open from the ${payoutDay}st of each month.`,
    ``,
    `— JKTL Business`,
  ].join("\n");

  return send(to, "You're approved — your JKTL partner dashboard is ready", html, text);
}

/**
 * Sent when an application is declined.
 *
 * Short, and it does not pretend to be a compliment. The applicant put real
 * thought into applying, so silence is the one response that is actually rude —
 * and a programme that never replies is one nobody recommends.
 *
 * Deliberately no reason beyond "on this occasion": decisions here are made by
 * hand on judgement, and inventing a specific justification invites an argument
 * nobody has time for. It leaves the door open, which is honest — applications
 * are judged on the plan described, and a better plan is a better application.
 */
export async function sendAffiliateDeclinedEmail(params: { to: string; name: string }): Promise<EmailResult> {
  const firstName = params.name.trim().split(/\s+/)[0] || "there";
  const html = wrapper(`
    <p style="margin:0 0 14px;font-size:15px"><strong>About your partner application</strong></p>
    <p>Hi ${firstName},</p>
    <p>Thank you for applying to the JKTL Business partner programme. We are not taking your application forward on this occasion.</p>
    <p>It is a judgement on the plan you described rather than on you — we keep the programme small and work closely with the partners we approve. You are welcome to apply again if your plans change.</p>
    <p style="font-size:13px;color:#5b6470">If you think this was a mistake, reply to this email and a person will read it.</p>
    <p style="margin:18px 0 0">— JKTL Business</p>
  `);
  const text = `Hi ${firstName},\n\nThank you for applying to the JKTL Business partner programme. We are not taking your application forward on this occasion.\n\nIt is a judgement on the plan you described rather than on you. You are welcome to apply again if your plans change.\n\nIf you think this was a mistake, reply to this email and a person will read it.\n\n— JKTL Business`;
  return send(params.to, "About your JKTL partner application", html, text);
}

/** Domain notices contain no registrant contact/address or supplier credentials. Resend deduplicates retries. */
export async function sendDomainOrderEmail(p:{to:string;domain:string;event:string;detail:string;key:string}):Promise<EmailResult>{
 if(!p.to||!p.to.includes('@'))return{ok:false,error:'Missing recipient'};
 const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 try{const{error}=await getResend().emails.send({from:FROM,to:p.to,subject:`${p.event}: ${p.domain}`,text:`${p.event}\n\n${p.domain}\n${p.detail}\n\nView your domain order securely at https://business.jktl.com.ng/business/domains`,html:`<div style="font-family:Arial;max-width:520px;margin:auto;background:#fdfcf8;border:1px solid #c9a84c;padding:24px;color:#060e2a"><h2>JKTL Business</h2><h3>${escape(p.event)}</h3><p><strong>${escape(p.domain)}</strong></p><p>${escape(p.detail)}</p><a href="https://business.jktl.com.ng/business/domains">View My Domains</a></div>`},{idempotencyKey:p.key});return error?{ok:false,error:'Email delivery failed'}:{ok:true};}catch{return{ok:false,error:'Email delivery unavailable'};}
}

/** Custom clients receive an activation link only after a configured pilot. */
export async function sendCustomInvitationEmail(p:{to:string;name:string;url:string}):Promise<EmailResult>{
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return send(p.to,'Your JKTL Custom workspace is ready',`<div style="font-family:Arial;background:#fdfcf8;color:#060e2a;padding:32px"><h1>Welcome to JKTL Custom</h1><p>${escape(p.name)}, your client workspace is ready for review.</p><p>Manage your connected websites, service agreements, invoices and support in JKTL Business.</p><p><a href="${escape(p.url)}">Activate your workspace</a></p><p>This link expires in 48 hours and works once. Existing account holders sign in with their existing password. We never email passwords.</p></div>`,`Your JKTL Custom workspace for ${p.name} is ready. Activate within 48 hours: ${p.url}. This link works once. Existing account holders keep their password.`);
}

export async function sendCustomNoticeEmail(p:{to:string;subject:string;detail:string;key:string;path?:string}):Promise<EmailResult>{try{if(!p.to)return{ok:false,error:'Missing recipient'};const r=await getResend().emails.send({from:FROM,to:p.to,subject:p.subject,text:`${p.detail}\n\nReview your JKTL workspace: ${(process.env.NEXT_PUBLIC_APP_URL||'https://business.jktl.com.ng')}${p.path||'/business/custom'}`},{idempotencyKey:p.key});return r.error?{ok:false,error:'Delivery failed'}:{ok:true};}catch{return{ok:false,error:'Delivery unavailable'};}}

export async function sendPartnerApprovedEmail(p:{to:string;name:string;signInUrl:string;referralLink:string;commissionBps:number;needsPasswordSetup?:boolean}):Promise<EmailResult>{const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));return send(p.to,'Your JKTL Partner account is approved',wrapper(`<h2>Welcome to JKTL Partners</h2><p>Hi ${escape(p.name)}, your application has been approved.</p><p>${p.needsPasswordSetup?`Your earlier application did not include a password. <a href="${escape((process.env.NEXT_PUBLIC_APP_URL||'https://business.jktl.com.ng')+'/affiliates/forgot-password')}">Request a secure password setup link</a> using your approved email address.`:`Use your existing application password to <a href="${escape(p.signInUrl)}">sign in to your partner workspace</a>.`}</p><p>Your agreed commission rate is ${p.commissionBps/100}% on qualifying purchases under your partner agreement. No signup or fixed bonus is implied.</p><p>Referral link: ${escape(p.referralLink)}</p>`),`Your JKTL Partner account is approved. ${p.needsPasswordSetup?"Request secure password setup from the programme password reset page using your approved email. ":""}Sign in: ${p.signInUrl}. Your agreed rate is ${p.commissionBps/100}% on qualifying purchases under your agreement. Referral link: ${p.referralLink}.`);}
