/**
 * The cold-outreach sequence: four emails over three weeks instead of one blast.
 *
 * **Why a sequence at all.** A single cold email is a coin flip: most businesses
 * that would have bought simply did not open it on the day it arrived. Four
 * touches — an introduction, something useful with no ask, a short case, then a
 * direct offer — convert several times better than the same words once, without
 * ever being a "campaign". And spacing them over weeks is what keeps the sending
 * domain out of trouble: forty cold emails a day from one domain is normal,
 * four hundred is not.
 *
 * **Why this file is pure.** Every decision that could embarrass us — which step
 * is next, whether it is due, whether a reply or an unsubscribe should stop the
 * sequence, what the email says — is here, with no database, no clock, no
 * network. That is what makes it unit-testable: the rules below are asserted
 * rather than trusted, and a change to the cadence is a one-line diff with a
 * failing test if it is wrong.
 *
 * It deliberately has **no imports at all**, not even type-only ones: the tests
 * import this file directly with Node, which cannot resolve the `@/` alias.
 */

/** One day in milliseconds. Spelled out rather than imported, for the same
 * reason there are no imports. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The four steps, in the order they are sent. */
export type SequenceStepKey = "intro" | "tips" | "proof" | "offer";

/**
 * Everything an email needs that is not part of the step itself.
 *
 * Passed in rather than looked up, so a caller can render a preview for a
 * prospect that has no site yet, or an email for a business whose settings were
 * changed mid-sequence, without the composition code knowing about either.
 */
export interface SequenceContext {
  /** The recipient's business name, as it appears on their Google listing. */
  businessName: string;
  /** Used to make the copy local rather than generic. May be empty. */
  city: string;
  /** The generated site — the thing being sold. */
  siteUrl: string;
  /** Our sending identity, e.g. "JKTL Business". */
  myBusiness: string;
  /** The recipient's personal opt-out link. Every step carries it. */
  unsubscribeUrl: string;
}

export interface SequenceStep {
  key: SequenceStepKey;
  /**
   * Days after the *start of the sequence* on which this step is due — not the
   * gap since the previous step. Stored as absolute offsets because that is how
   * the cadence is described ("day 0, day 4, day 11, day 21"), and the gap is
   * then derived by subtraction so the two can never disagree.
   */
  dayOffset: number;
  /** Their name is in every subject line: a subject that leads with the sender
   * reads as an advert and gets deleted unread. */
  subject: (businessName: string, myBusiness: string) => string;
  /** Plain text. HTML is generated from it by `renderStep`, so the two cannot
   * drift apart and the text version is always the real message. */
  body: (ctx: SequenceContext) => string;
}

export interface SequenceEmail {
  subject: string;
  text: string;
  html: string;
}

/** Input to `dueStep`. Named fields rather than positional booleans, because
 * three bare booleans at a call site is a bug waiting to happen. */
export interface DueStepInput {
  /** The step last sent, or "" for a prospect that has not been started. */
  currentStepKey: string;
  /** When the last step went out. Ignored for a prospect that has not started. */
  lastSentAt: Date | string | null;
  /** Injected rather than read from the clock, so "is it due" is testable. */
  now: Date;
  replied: boolean;
  unsubscribed: boolean;
  converted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** " in Lagos" when we know the city, "" when we do not — never " in ". */
function where(ctx: SequenceContext): string {
  const city = ctx.city.trim();
  return city ? ` in ${city}` : "";
}

/** The greeting. Shared so every step opens the same way, and so a missing
 * business name degrades to "Hi team," rather than "Hi  team,". */
function greeting(ctx: SequenceContext): string {
  const name = ctx.businessName.trim();
  return name ? `Hi ${name} team,` : "Hi team,";
}

/**
 * The opt-out, on every single email.
 *
 * This is not a footer formality: a sequence is four messages, so a working
 * unsubscribe link is the difference between marketing and harassment, and it is
 * what the NDPA legitimate-interest basis actually rests on. A missing link on
 * step three would quietly make steps two, three and four unlawful.
 */
function footer(ctx: SequenceContext): string {
  const name = ctx.businessName.trim() || "your business";
  return `You are getting this because ${name} is listed publicly on Google Maps. If you would rather not hear from us again, stop these emails here: ${ctx.unsubscribeUrl}`;
}

/** Text → simple HTML. Paragraphs on blank lines, links for the two URLs that
 * need to be tappable, everything else escaped. */
function textToHtml(text: string, ctx: SequenceContext): string {
  const withLinks = (input: string, url: string): string => {
    if (!url) return input;
    const escapedUrl = escapeHtml(url);
    return input
      .split(escapedUrl)
      .join(`<a href="${escapedUrl}" style="color:#0f6e5c">${escapedUrl}</a>`);
  };

  let safe = escapeHtml(text);
  safe = withLinks(safe, ctx.unsubscribeUrl);
  safe = withLinks(safe, ctx.siteUrl);

  const paragraphs = safe
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 14px">${block.replace(/\n/g, "<br/>")}</p>`)
    .join("\n  ");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#12151b;line-height:1.55">
  ${paragraphs}
</div>`;
}

/* -------------------------------------------------------------------------- */
/* The steps                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The four emails.
 *
 * Order is the cadence and the array index is the position in the sequence, so
 * this array is the single source of truth: reordering it reorders the sending,
 * and the offsets must stay strictly increasing (asserted in the tests).
 *
 * No step invents a fact. The intro names the site that exists; the tips are
 * generic advice with no claim about this business; the case is told in shape
 * rather than in numbers on purpose — a fabricated statistic is both a lie and
 * the first thing a recipient can check; and the offer links the site that was
 * actually built.
 */
export const SEQUENCE_STEPS: SequenceStep[] = [
  {
    key: "intro",
    dayOffset: 0,
    // Same wording as `DEFAULT_SUBJECT_TEMPLATE` in `outreach.ts`. The one-off
    // send uses the admin's editable template; a sequence step cannot, because
    // each step needs its own subject and rewriting "we built you a website"
    // onto the tips email would be nonsense.
    subject: (businessName, myBusiness) => `${businessName} — ${myBusiness} built you a new website`,
    body: (ctx) => [
      greeting(ctx),
      "",
      `We came across ${ctx.businessName}${where(ctx)} on Google Maps and had a look at what a customer sees when they search for you. So we built you a new website — your name, your location and your services on it, working properly on a phone, with one tap to call or message you.`,
      "",
      `See it here: ${ctx.siteUrl}`,
      "",
      `Nothing to install and nothing to pay to look at it. If you would like it, or want changes before deciding, just reply to this email.`,
      "",
      `— ${ctx.myBusiness}`,
      "",
      footer(ctx),
    ].join("\n"),
  },
  {
    key: "tips",
    dayOffset: 4,
    subject: (businessName, myBusiness) => `${businessName}: 3 booking tips, from ${myBusiness}`,
    body: (ctx) => [
      greeting(ctx),
      "",
      `No pitch in this one. Three things that reliably turn interest into bookings, whether or not you ever work with ${ctx.myBusiness}.`,
      "",
      `1. Answer the first message quickly. Most people who want an appointment today are messaging three businesses at once and booking with whoever answers first. Even "we can do 4pm, shall I book you in?" is enough.`,
      "",
      `2. Put your next free slot where people can see it. "Next available: Thursday 10am" on your listing, your page and your WhatsApp status removes the biggest reason someone puts off booking — not knowing how long the wait is.`,
      "",
      `3. Ask for the review the same day, while they are still pleased with you. A one-line message with a direct link is all it takes, and the reviews are what make the next customer choose you over the business next door.`,
      "",
      `That is it. If one of those pays for itself this month, it did its job.`,
      "",
      `— ${ctx.myBusiness}`,
      "",
      footer(ctx),
    ].join("\n"),
  },
  {
    key: "proof",
    dayOffset: 11,
    subject: (businessName, myBusiness) => `${businessName}: one missed call, one booking — ${myBusiness}`,
    body: (ctx) => [
      greeting(ctx),
      "",
      `A short story, because it is easier to show than to describe.`,
      "",
      `A business in the same line of work was losing every call that came in while the owner was with a customer. The phone rang, nobody picked up, and the caller booked somewhere else. The assistant answered those calls, took the name, the service and the time, and put them in the diary. The next morning started with a list of appointments instead of a list of missed calls.`,
      "",
      `That is the part that is hard to do by hand when you are the person doing the work, and it is the part that pays for itself.`,
      "",
      `If you would like to see what that would look like for ${ctx.businessName}, just reply to this email. No call needed.`,
      "",
      `— ${ctx.myBusiness}`,
      "",
      footer(ctx),
    ].join("\n"),
  },
  {
    key: "offer",
    dayOffset: 21,
    subject: (businessName, myBusiness) => `${businessName}, your website is ready — ${myBusiness}`,
    body: (ctx) => [
      greeting(ctx),
      "",
      `This is the last email I will send about it, so here is the direct ask.`,
      "",
      `We built ${ctx.businessName} a website and it is live now: ${ctx.siteUrl}`,
      "",
      `It is yours if you want it. If you would like it on your own domain, or want anything changed first, reply to this email and we will sort it out. If it is not for you, that is a perfectly good answer too — the unsubscribe link below takes you off this list and you will not hear from us again.`,
      "",
      `— ${ctx.myBusiness}`,
      "",
      footer(ctx),
    ].join("\n"),
  },
];

/* -------------------------------------------------------------------------- */
/* Position in the sequence                                                   */
/* -------------------------------------------------------------------------- */

/** The step a prospect starts on. Exported so the enrolment code in the
 * database layer names it once instead of hard-coding "intro". */
export const firstStepKey: SequenceStepKey = "intro";

/**
 * The step for a key, or null when the key is not one of ours.
 *
 * Returning null rather than throwing matters at the call site: the key comes
 * from a text column that an admin, an old release or a hand-written UPDATE can
 * put anything into, and a renderer that throws would take the whole cron run
 * down for one bad row.
 */
export function stepByKey(key: string): SequenceStep | null {
  const wanted = (key ?? "").trim();
  if (!wanted) return null;
  for (const step of SEQUENCE_STEPS) {
    if (step.key === wanted) return step;
  }
  return null;
}

/**
 * The key of the step after this one, or null when there is no successor.
 *
 * "" means "not started" and returns the first step, so enrolment and
 * advancement share one function. An unrecognised key returns null rather than
 * restarting at the intro: a prospect whose position we cannot determine must
 * not be sent a second introduction, with the unique per-step index then failing
 * on the insert and the sequence stuck either way. Standing still is the safe
 * answer; a repeat of the intro is not.
 */
export function nextStepKey(currentStepKey: string): SequenceStepKey | null {
  const current = (currentStepKey ?? "").trim();
  if (!current) return firstStepKey;
  const index = SEQUENCE_STEPS.findIndex((step) => step.key === current);
  if (index === -1) return null;
  const next = SEQUENCE_STEPS[index + 1];
  return next ? next.key : null;
}

/** True for the last step only. Unknown keys are not final — nothing was sent,
 * so there is nothing to stop. */
export function isFinalStep(stepKey: string): boolean {
  const step = stepByKey(stepKey);
  if (!step) return false;
  return SEQUENCE_STEPS[SEQUENCE_STEPS.length - 1]?.key === step.key;
}

/**
 * How many days after the previous send the next step is due.
 *
 * Derived by subtracting the offsets rather than stored twice: day 4 minus day 0
 * is a four-day wait after the intro, day 11 minus day 4 is a seven-day wait, and
 * day 21 minus day 11 is ten. Because the offsets are absolute, a *slow* previous
 * send (a cron that missed a day, a reply that took a week to clear) does not
 * push the whole cadence back by its own lateness — the schedule stays anchored
 * to the start of the sequence.
 */
function gapDaysBetween(currentStepKey: string, nextStep: SequenceStep): number {
  const current = stepByKey(currentStepKey);
  return Math.max(0, nextStep.dayOffset - (current?.dayOffset ?? 0));
}

/**
 * The step that should go out now, or null when nothing should.
 *
 * Every stopping condition lives here rather than in the cron, because this is
 * the rule that decides whether a stranger gets emailed again:
 *
 *   - **A reply stops the sequence.** They are talking to a human now; the next
 *     automated email would talk over the person they are actually having a
 *     conversation with.
 *   - **An unsubscribe stops it.** Permanently and immediately, since continuing
 *     is both the fastest way to a complaint and the one thing the opt-out
 *     promised not to do.
 *   - **A conversion stops it.** Selling a website to the business that just
 *     bought one is the clearest possible signal that nobody checked the state.
 *   - **The day offset is respected.** Sending step two the morning after step
 *     one is the "sequence" collapsing back into the blast it replaced.
 *
 * A started prospect with no `lastSentAt` returns null: without the anchor we
 * cannot prove the wait has passed, and guessing would send early.
 */
export function dueStep(input: DueStepInput): SequenceStepKey | null {
  if (input.replied || input.unsubscribed || input.converted) return null;

  const current = (input.currentStepKey ?? "").trim();
  // An unknown key is a data fault, not a position: refuse rather than guess.
  if (current && !stepByKey(current)) return null;

  const nextKey = nextStepKey(current);
  if (!nextKey) {
    // Either the final step is done or the current key is a corrupt one — even
    // in the corrupt case, null is the answer.
    return null;
  }
  const next = stepByKey(nextKey);
  if (!next) return null;

  // Never started: nothing has been sent, so nothing has to elapse.
  if (!current) return next.key;

  if (!input.lastSentAt) return null;
  const lastMs = input.lastSentAt instanceof Date ? input.lastSentAt.getTime() : new Date(input.lastSentAt).getTime();
  if (Number.isNaN(lastMs)) return null;

  const nowMs = input.now.getTime();
  if (Number.isNaN(nowMs)) return null;

  const waitMs = gapDaysBetween(current, next) * DAY_MS;
  return nowMs >= lastMs + waitMs ? next.key : null;
}

/**
 * When the step after `currentStepKey` becomes due, or null when there is none.
 *
 * The database needs a concrete timestamp for `next_outreach_at`; computing it
 * with the same subtraction `dueStep` uses is what stops the stored date and the
 * read-side check from drifting apart. Null means "the sequence is finished", and
 * the due query skips a null rather than re-sending anything.
 */
export function nextOutreachAt(currentStepKey: string, sentAt: Date): Date | null {
  const nextKey = nextStepKey(currentStepKey);
  if (!nextKey) return null;
  const next = stepByKey(nextKey);
  if (!next) return null;
  const at = sentAt instanceof Date ? sentAt : new Date(sentAt);
  if (Number.isNaN(at.getTime())) return null;
  return new Date(at.getTime() + gapDaysBetween(currentStepKey, next) * DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The finished email for one step, or null for a key that is not ours.
 *
 * HTML is derived from the plain text, so the two versions always say the same
 * thing — an HTML-only email reads badly in a plain-text client, and a separate
 * hand-written HTML body is a second copy of the copy that nobody keeps in sync.
 * The text body is the real message; the HTML is a rendering of it.
 */
export function renderStep(stepKey: string, ctx: SequenceContext): SequenceEmail | null {
  const step = stepByKey(stepKey);
  if (!step) return null;
  const text = step.body(ctx);
  return {
    subject: step.subject(ctx.businessName, ctx.myBusiness),
    text,
    html: textToHtml(text, ctx),
  };
}
