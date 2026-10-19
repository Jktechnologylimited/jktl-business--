/**
 * Automated nudges: the push notifications that prompt a business to finish
 * setting something up.
 *
 * These are the "set up your account to receive your money in your sleep"
 * messages. The rule that makes them acceptable rather than spam is that a
 * nudge is a **statement about the business's own state**, not a marketing
 * message — it fires because something is genuinely missing, it says what the
 * consequence is, and it goes quiet once the condition is fixed.
 *
 * So each nudge declares:
 *   - `condition`  — the state that has to be true for it to be relevant
 *   - `repeatable` — whether it can fire again after being resolved (a wallet
 *                    can run low twice; "you have no services" is a one-off)
 *   - `cooldownDays` — the minimum gap between repeats, so a condition that
 *                    persists doesn't turn into a daily reminder
 *
 * Pure and dependency-free so the whole judgement about when to interrupt
 * someone can be unit tested. The database side (which nudges have already
 * been sent, and whether the cooldown has elapsed) is in `src/lib/db/nudges.ts`.
 */

export type NudgeId =
  | "add_card"
  | "add_number"
  | "add_services"
  | "top_up_wallet"
  | "connect_payments"
  | "share_booking_link"
  | "chase_overdue_invoice";

export interface NudgeDefinition {
  id: NudgeId;
  /** Shown in the notification. Written as an instruction with a reason. */
  title: string;
  body: string;
  /** Where tapping it goes. */
  url: string;
  /** May fire again after the condition is resolved. */
  repeatable: boolean;
  /** Minimum days between repeats for a repeatable nudge. */
  cooldownDays: number;
}

/**
 * The catalogue.
 *
 * Ordering matters: `evaluateNudges` returns at most one per run, choosing the
 * most valuable applicable nudge first. Getting paid beats tidying up your
 * service list, so `add_card` is first.
 */
export const NUDGES: NudgeDefinition[] = [
  {
    id: "add_card",
    title: "Get paid while you sleep",
    body: "Add a card and your receptionist subscription renews itself — no logging in, no missed month, no interruption to your phone line.",
    url: "/business/receptionist",
    repeatable: false,
    cooldownDays: 0,
  },
  {
    id: "top_up_wallet",
    title: "Your assistant is nearly out of credit",
    body: "Top up your communication wallet so missed calls keep getting a text back. Free credit is used first, so you only pay when it runs out.",
    url: "/business/receptionist",
    // A wallet can be drained more than once, so this one may repeat — but no
    // more than fortnightly, because the state is visible in the app anyway.
    repeatable: true,
    cooldownDays: 14,
  },
  {
    id: "connect_payments",
    title: "Take payments without chasing them",
    body: "Connect your bank account and JKTL can send invoices your customers pay online. The money lands in your account — no transfers to confirm by hand.",
    url: "/business/settings",
    repeatable: false,
    cooldownDays: 0,
  },
  {
    id: "add_number",
    title: "Add your business number",
    body: "Give the assistant a line to answer and missed calls start turning into bookings automatically.",
    url: "/business/receptionist",
    repeatable: false,
    cooldownDays: 0,
  },
  {
    id: "add_services",
    title: "Tell the assistant what you sell",
    body: "Add your services and prices so it can quote and book without asking you first.",
    url: "/business/services",
    repeatable: false,
    cooldownDays: 0,
  },
  {
    id: "share_booking_link",
    title: "Put your booking link to work",
    body: "You haven't had a booking through your page yet. Paste the link into your WhatsApp status or Instagram bio — it books while you're busy.",
    url: "/business/website",
    repeatable: true,
    cooldownDays: 30,
  },
  {
    id: "chase_overdue_invoice",
    title: "You're owed money",
    body: "An invoice has been unpaid for over a month. Send a reminder from the invoice — it takes one tap.",
    url: "/business/invoices",
    repeatable: true,
    cooldownDays: 14,
  },
];

const BY_ID = new Map(NUDGES.map((n) => [n.id, n]));

export function getNudge(id: string): NudgeDefinition | null {
  return BY_ID.get(id as NudgeId) ?? null;
}

/**
 * The business state a nudge can be conditioned on.
 *
 * Every field is something the app already knows; nothing here is inferred or
 * guessed. `null` means "not applicable" — a business without the receptionist
 * switched on should not be told to add a card for it.
 */
export interface NudgeContext {
  /** A receptionist contract exists and is running. */
  hasContract: boolean;
  /** No reusable card on file, so the subscription cannot renew itself. */
  needsCard: boolean;
  /** Receptionist is switched on but has no line to answer. */
  needsNumber: boolean;
  /** Free credit is spent and there is no paid balance left. */
  needsWalletTopUp: boolean;
  /** The business has no active services listed. */
  needsServices: boolean;
  /** Payments are not connected, so invoices cannot be paid online. */
  needsPayments: boolean;
  /** Published site, receptionist on, but no bookings ever received. */
  noBookingsYet: boolean;
  /** At least one invoice has been unpaid for more than 30 days. */
  hasOverdueInvoice: boolean;
}

export interface NudgeState {
  /** nudge id → what we know about previous sends. */
  sent: Record<string, { sentCount: number; lastSentAt: string | null; resolvedAt: string | null }>;
}

/** True when the condition for this nudge currently holds. */
export function conditionHolds(id: NudgeId, ctx: NudgeContext): boolean {
  switch (id) {
    case "add_card":
      return ctx.hasContract && ctx.needsCard;
    case "add_number":
      return ctx.needsNumber;
    case "add_services":
      return ctx.needsServices;
    case "top_up_wallet":
      return ctx.needsWalletTopUp;
    case "connect_payments":
      return ctx.needsPayments;
    case "share_booking_link":
      return ctx.noBookingsYet;
    case "chase_overdue_invoice":
      return ctx.hasOverdueInvoice;
    default:
      return false;
  }
}

function daysBetween(from: string, now: Date): number {
  const then = new Date(from).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / (24 * 60 * 60 * 1000);
}

/**
 * Should this nudge be sent, given what we've already sent?
 *
 * A one-off fires once ever. A repeatable one is allowed again once its
 * cooldown has elapsed — and the clock restarts when the condition is resolved,
 * so "you're owed money" can come back the next time it's true rather than
 * being permanently silenced by the first send.
 */
export function shouldSend(
  definition: NudgeDefinition,
  state: NudgeState,
  now: Date,
): { send: boolean; reason: string } {
  const record = state.sent[definition.id];
  if (!record || record.sentCount === 0) return { send: true, reason: "not sent before" };

  if (!definition.repeatable) return { send: false, reason: "one-off, already sent" };

  // Resolved since the last send: treat it as a fresh occurrence.
  if (record.resolvedAt && record.lastSentAt && new Date(record.resolvedAt) > new Date(record.lastSentAt)) {
    return { send: true, reason: "condition came back after being resolved" };
  }

  const since = record.lastSentAt ? daysBetween(record.lastSentAt, now) : Number.POSITIVE_INFINITY;
  if (since < definition.cooldownDays) {
    return { send: false, reason: `cooldown, ${Math.ceil(definition.cooldownDays - since)} day(s) left` };
  }
  return { send: true, reason: "cooldown elapsed" };
}

/**
 * The nudge to send, if any: the first applicable one in catalogue order whose
 * history permits it. At most one per run, so a business setting up for the
 * first time gets a sequence over days rather than a notification avalanche in
 * one afternoon.
 */
export function evaluateNudges(
  ctx: NudgeContext,
  state: NudgeState,
  now: Date,
): { nudge: NudgeDefinition; reason: string } | null {
  for (const definition of NUDGES) {
    if (!conditionHolds(definition.id, ctx)) continue;
    const decision = shouldSend(definition, state, now);
    if (decision.send) return { nudge: definition, reason: decision.reason };
  }
  return null;
}
