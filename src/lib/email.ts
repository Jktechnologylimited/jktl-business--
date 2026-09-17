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
}): Promise<EmailResult> {
  const { to, customerName, businessName, invoiceNumber, totalKobo, dueDate, lines } = params;
  const rows = lines
    .map((l) => `<tr><td style="padding:4px 0">${l.description} ×${l.quantity}</td><td style="text-align:right">${formatKobo(l.totalKobo)}</td></tr>`)
    .join("");
  const html = wrapper(`
    <p>Hi ${customerName},</p>
    <p><strong>${businessName}</strong> sent you invoice <strong>${invoiceNumber}</strong>, due ${formatShortDate(dueDate)}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
    <p style="text-align:right;font-weight:700;font-size:16px">Total: ${formatKobo(totalKobo)}</p>
  `);
  const text = `Hi ${customerName},\n\n${businessName} sent you invoice ${invoiceNumber}, due ${formatShortDate(dueDate)}. Total: ${formatKobo(totalKobo)}.`;
  return send(to, `Invoice ${invoiceNumber} from ${businessName}`, html, text);
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

export async function sendRenewalReminderEmail(params: {
  to: string;
  businessName: string;
  renewalDate: string;
  priceKobo: number;
}): Promise<EmailResult> {
  const { to, businessName, renewalDate, priceKobo } = params;
  const html = wrapper(`
    <p>Hi,</p>
    <p>Your JKTL Business plan for <strong>${businessName}</strong> renews on <strong>${formatShortDate(renewalDate)}</strong> (${formatKobo(priceKobo)}/year).</p>
    <p>No action needed if your details are up to date.</p>
  `);
  const text = `Your JKTL Business plan for ${businessName} renews on ${formatShortDate(renewalDate)} (${formatKobo(priceKobo)}/year).`;
  return send(to, `Your plan renews soon — ${businessName}`, html, text);
}
