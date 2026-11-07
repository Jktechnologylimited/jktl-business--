export const CARE_STEPS = {
  brief: "Confirm the business goals and collect the customer brief",
  branding: "Review logo, contact details, photos and page content",
  template: "Agree the template or custom-site design with the customer",
  quality: "Test phone/desktop layout, navigation and contact forms",
  domain_email_renewals:
    "Discuss domain/email needs and confirm applicable renewal dates",
  training: "Help the owner practise updating their website",
  signoff: "Record the customer’s approval of the final website",
  live: "Verify the live website and complete the handover",
  feedback:
    "Invite honest feedback; ask permission before any public case study",
} as const;
export const CARE_STATUS = {
  NEEDS_CONTACT: "Needs initial contact",
  IN_PROGRESS: "Setup in progress",
  WAITING_CUSTOMER: "Waiting for customer details",
  READY: "Ready for customer review",
  COMPLETE: "Launched & handed over",
} as const;
export function careInput(form: FormData) {
  const status = String(form.get("status") || ""),
    steps = [...new Set(form.getAll("steps").map(String))],
    notes = String(form.get("notes") || "").trim(),
    follow = String(form.get("follow") || ""),
    revision = Number(form.get("revision"));
  if (
    !Object.hasOwn(CARE_STATUS, status) ||
    steps.some((s) => !Object.hasOwn(CARE_STEPS, s)) ||
    notes.length > 2000 ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (follow &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(follow) ||
        !Number.isFinite(new Date(follow + "T00:00:00Z").getTime()) ||
        new Date(follow + "T00:00:00Z").toISOString().slice(0, 10) !== follow))
  )
    throw Error("Check the setup status, checklist and follow-up date.");
  if (
    status === "COMPLETE" &&
    Object.keys(CARE_STEPS)
      .filter((k) => k !== "feedback")
      .some((k) => !steps.includes(k))
  )
    throw Error(
      "Complete the setup, quality checks, customer approval and live handover before marking this account complete.",
    );
  return { status, steps, notes, follow: follow || null, revision };
}
