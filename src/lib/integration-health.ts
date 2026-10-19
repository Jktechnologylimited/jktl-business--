import "server-only";
import { isMessagingConfigured } from "@/lib/twilio";
import { isDeepSeekConfigured } from "@/lib/deepseek";

/**
 * Whether the platform's own credentials are in place.
 *
 * **Admin-only, deliberately.** The receptionist console used to tell a clinic
 * owner that "Twilio credentials are missing" and "DEEPSEEK_API_KEY is missing" —
 * which is both alarming and useless to them: they cannot fix a missing key, and
 * the message reads as though the product they just bought does not work. The
 * person who can fix it is whoever holds the deployment environment, so this
 * belongs on the admin side and nowhere else.
 *
 * Presence only — never the values. An admin needs to know *whether*
 * `PAYSTACK_SECRET_KEY` is set, not what it is, and printing a secret into a web
 * page is how secrets end up in screenshots and support tickets.
 */

export interface IntegrationStatus {
  name: string;
  /** What breaks without it, in the words of the thing a customer would notice. */
  consequence: string;
  configured: boolean;
  /** The variable(s) to set. Shown to the admin so the fix is actionable. */
  envVars: string[];
  /** Where an operator picks the credential up. */
  source: string;
}

function has(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

export function getIntegrationHealth(): IntegrationStatus[] {
  return [
    {
      name: "Twilio — calls and messaging",
      consequence: "Missed calls are recorded but no callback text is sent, and no business line can be bought.",
      configured: isMessagingConfigured(),
      envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
      source: "console.twilio.com",
    },
    {
      name: "DeepSeek — the assistant",
      consequence: "The assistant answers from its scripted fallback: correct prices and handoffs, but no open conversation.",
      configured: isDeepSeekConfigured(),
      envVars: ["DEEPSEEK_API_KEY"],
      source: "platform.deepseek.com",
    },
    {
      name: "Paystack — subscriptions and invoices",
      consequence: "No payment can be taken: no receptionist instalments, no wallet top-ups, no invoice collection.",
      configured: has("PAYSTACK_SECRET_KEY"),
      envVars: ["PAYSTACK_SECRET_KEY"],
      source: "dashboard.paystack.com",
    },
    {
      name: "Resend — email",
      consequence: "Invoices, receipts, partner approvals and password resets are skipped silently.",
      configured: has("RESEND_API_KEY", "RESEND_FROM_EMAIL"),
      envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      source: "resend.com/api-keys",
    },
    {
      name: "Web push (VAPID)",
      consequence: "No notifications reach a phone: no payment alerts, no setup nudges, no escalations.",
      configured: has("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"),
      envVars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      source: "npm run push:generate-keys",
    },
    {
      name: "Cron secret",
      consequence: "Scheduled jobs refuse to run: subscription collection, line rental, commissions and nudges all stop.",
      configured: has("CRON_SECRET"),
      envVars: ["CRON_SECRET"],
      source: "any long random string, also set in vercel.json's cron config",
    },
    {
      name: "Object storage (Vercel Blob)",
      consequence: "Prospect-site photographs are hot-linked from Google instead of copied, and uploads fail.",
      configured: has("BLOB_READ_WRITE_TOKEN"),
      envVars: ["BLOB_READ_WRITE_TOKEN"],
      source: "vercel.com → Storage → Blob",
    },
    {
      name: "Lead engine (Apify or Outscraper)",
      consequence: "No new leads can be found; existing prospects still work.",
      configured: has("APIFY_TOKEN") || has("OUTSCRAPER_API_KEY"),
      envVars: ["APIFY_TOKEN", "OUTSCRAPER_API_KEY"],
      source: "apify.com or outscraper.com",
    },
  ];
}

/** How many are missing, for a badge. */
export function missingIntegrationCount(statuses = getIntegrationHealth()): number {
  return statuses.filter((s) => !s.configured).length;
}
