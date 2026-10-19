import "server-only";
import { sendPush } from "@/lib/push";
import { sendEscalationEmail } from "@/lib/email";
import type { TriageSeverity } from "./industry-packs";

/**
 * Tells a human at the clinic that the agent has stopped and someone needs to
 * take over. Two channels, both best-effort and both silent on failure: a
 * push to whoever has the app installed, and an email to the address the
 * clinic configured.
 *
 * Why both: push only reaches devices that subscribed, and the escalation
 * that matters most — a patient describing a four-hour erection or a
 * possible stroke — must not depend on whether anyone happened to install
 * the PWA. Email is the backstop.
 *
 * The notification says what rule fired and who to call. It deliberately
 * does not include the patient's message; see `sendEscalationEmail`.
 */
export interface EscalationNotice {
  organizationId: string;
  businessName: string;
  patientName: string;
  patientPhone: string;
  /** Human-readable rule label, or the agent's own reason. */
  reason: string;
  severity: TriageSeverity | "handoff";
  /** True when the patient was told to seek emergency care themselves. */
  isEmergencyServices: boolean;
  escalationEmail: string;
}

export async function notifyEscalation(notice: EscalationNotice): Promise<void> {
  const urgent = notice.severity === "emergency" || notice.severity === "urgent";
  const who = notice.patientName || notice.patientPhone || "A patient";
  const title = notice.isEmergencyServices
    ? "Emergency flagged in chat"
    : urgent
      ? "A patient needs a person now"
      : "Chat flagged for review";

  await Promise.allSettled([
    sendPush(notice.organizationId, {
      title,
      body: `${who}: ${notice.reason}`,
      url: "/business/receptionist",
    }),
    notice.escalationEmail
      ? sendEscalationEmail({
          to: notice.escalationEmail,
          businessName: notice.businessName,
          patientName: notice.patientName,
          patientPhone: notice.patientPhone,
          reason: notice.reason,
          severity: notice.severity,
          isEmergencyServices: notice.isEmergencyServices,
        })
      : Promise.resolve(),
  ]);
}
