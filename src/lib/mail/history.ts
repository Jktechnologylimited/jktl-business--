import "server-only";
import { query } from "@/lib/custom/service";
/** Metadata only: never bodies, reset links, passwords or invitation tokens. */
export async function recordMailAttempt(p: {
  key?: string;
  to: string;
  subject: string;
  category: string;
  state: "ACCEPTED" | "FAILED" | "UNKNOWN" | "SUPPRESSED";
  providerId?: string;
  errorCode?: string;
}) {
  try {
    await query(
      `INSERT INTO email_send_history(attempt_key,recipient,subject,category,provider_message_id,provider_state,error_code)
   VALUES($1,lower($2),$3,$4,$5,$6,$7) ON CONFLICT(attempt_key) DO UPDATE SET
   provider_message_id=COALESCE(email_send_history.provider_message_id,excluded.provider_message_id),
   provider_state=CASE WHEN email_send_history.provider_state='ACCEPTED' THEN 'ACCEPTED' ELSE excluded.provider_state END,error_code=excluded.error_code`,
      [
        p.key || null,
        p.to,
        p.subject.slice(0, 160),
        p.category,
        p.providerId || null,
        p.state,
        p.errorCode?.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || null,
      ],
    );
  } catch {
    /* A history-store failure must not repeat or undo provider acceptance. */
  }
}
