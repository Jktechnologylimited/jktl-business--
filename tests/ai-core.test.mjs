/**
 * Tests for the pure AI-receptionist core: pricing, packs, triage and SMS.
 *
 * Run with `npm test` (node's built-in test runner, no framework). Node
 * strips the TypeScript types on import, which is why the modules under test
 * import nothing at runtime — see the header comment in each.
 *
 * These are not smoke tests. Each one pins a claim that either appears in
 * the sales deck (the ₦25,000-a-call ROI, the ₦5–₦10 session cost, the
 * three-bookings-break-even line, the 95% margin) or is a safety property of
 * the clinical screening. If one of these fails, something a clinic was
 * promised has stopped being true.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  SETUP_FEE_KOBO,
  SETUP_MONTHS,
  SETUP_MONTHLY_KOBO,
  MONTHLY_FEE_KOBO,
  CANCEL_ANY_TIME,
  FREE_CREDIT_KOBO,
  SMS_UNIT_COST_KOBO,
  TYPICAL_SESSION_USAGE,
  aiUsageCostKobo,
  typicalSessionCostKobo,
  grossMargin,
  subscriptionEconomics,
  sessionsAtMargin,
  amortize,
  setupAmortization,
  amountForMonth,
  phaseForMonth,
  contractSchedule,
  platformPhaseStart,
  currentMonthIndex,
  currentPhase,
  monthsUntilPlatformPhase,
  isPlatformPhase,
  nextPaymentDue,
  totalContractValue,
  averageMonthlyKobo,
  cancellationSummary,
  breakEvenBookings,
  DEFAULT_CONTRACT_TERMS,
  clinicRoi,
  DEFAULT_CLINIC_ROI_INPUT,
  arrKobo,
  valuationRangeKobo,
  clinicsForValuation,
} from "../src/lib/ai/pricing.ts";

import {
  INDUSTRY_PACKS,
  getPack,
  packForBusinessType,
  EMERGENCY_NUMBER,
} from "../src/lib/ai/industry-packs.ts";

import { screenMessage, requiresHandoff, requiresEmergencyServices, normalizeForScreening } from "../src/lib/ai/triage.ts";

import { renderSms, renderTemplate, smsSegments, smsCostKobo, buildChatLink } from "../src/lib/ai/sms.ts";

import { buildSystemPrompt, buildGreeting, buildTools } from "../src/lib/ai/prompt.ts";

/* ------------------------------------------------------------------ */
/* Commercial structure                                                */
/* ------------------------------------------------------------------ */

test("the published price points are the ones in the contract", () => {
  assert.equal(SETUP_FEE_KOBO, 65_000_000, "N650,000 turnkey package");
  assert.equal(SETUP_MONTHS, 6, "billed over six months");
  assert.equal(SETUP_MONTHLY_KOBO, 10_833_333, "N108,333.33 per month");
  assert.equal(MONTHLY_FEE_KOBO, 5_900_000, "N59,000/month from month 7");
  assert.equal(SMS_UNIT_COST_KOBO, 450, "N4.50 per SMS segment");
  assert.equal(CANCEL_ANY_TIME, true, "no minimum term");
  assert.ok(FREE_CREDIT_KOBO > 0, "the package bundles a comms credit pool");
});

test("the N650,000 splits into six instalments that sum to exactly N650,000", () => {
  assert.equal(DEFAULT_CONTRACT_TERMS.setupMonths, SETUP_MONTHS, "the exported terms are the ones tested");
  assert.equal(DEFAULT_CONTRACT_TERMS.setupFeeKobo, SETUP_FEE_KOBO);
  const instalments = setupAmortization();
  assert.equal(instalments.length, 6);
  assert.equal(
    instalments.reduce((a, b) => a + b, 0),
    SETUP_FEE_KOBO,
    "the rounding must not leave a gap against the contract",
  );
  // 650,000 / 6 = 108,333.33 and a third: the odd kobo go on the earliest
  // instalments rather than being lost.
  assert.deepEqual(instalments, [10_833_334, 10_833_334, 10_833_333, 10_833_333, 10_833_333, 10_833_333]);
  assert.equal(instalments[0] + instalments[5], 21_666_667);
});

test("amortize never loses or invents a kobo, for any split", () => {
  for (const total of [1, 7, 65_000_000, 5_900_000, 999_999_999]) {
    for (const months of [1, 2, 3, 6, 7, 12]) {
      const parts = amortize(total, months);
      assert.equal(parts.length, months, `${total} over ${months}`);
      assert.equal(parts.reduce((a, b) => a + b, 0), total, `${total} over ${months} must sum exactly`);
      assert.ok(Math.max(...parts) - Math.min(...parts) <= 1, "instalments differ by at most one kobo");
    }
  }
});

test("months 1-6 are the instalments, month 7 onward is the N59,000 tier", () => {
  for (let month = 1; month <= 6; month += 1) {
    assert.equal(phaseForMonth(month), "setup", `month ${month}`);
    assert.ok(amountForMonth(month) > 10_833_000, `month ${month} is an instalment`);
  }
  assert.equal(phaseForMonth(7), "platform");
  assert.equal(amountForMonth(7), MONTHLY_FEE_KOBO, "month 7 drops to the platform tier");
  assert.equal(amountForMonth(24), MONTHLY_FEE_KOBO);
  assert.equal(amountForMonth(0), 0, "there is no month zero");
});

test("the platform tier begins in month 7, across a year boundary", () => {
  const started = new Date("2025-09-15T10:00:00Z");
  assert.equal(platformPhaseStart(started).toISOString().slice(0, 10), "2026-03-15");
  // Month arithmetic keeps the time of day, so the tier starts at the same
  // clock time on the same date six months on — not at midnight.
  assert.equal(isPlatformPhase(started, new Date("2026-03-15T09:59:00Z")), false);
  assert.equal(isPlatformPhase(started, new Date("2026-03-15T10:00:00Z")), true);
});

test("the schedule dates every payment from the day the contract started", () => {
  const started = new Date("2026-01-10T00:00:00Z");
  const schedule = contractSchedule(started, 8);
  assert.equal(schedule.length, 8);
  assert.equal(schedule[0].dueAt.toISOString().slice(0, 10), "2026-01-10", "month 1 is due at signup, not a month later");
  assert.equal(schedule[5].dueAt.toISOString().slice(0, 10), "2026-06-10", "month 6");
  assert.equal(schedule[6].dueAt.toISOString().slice(0, 10), "2026-07-10", "month 7 starts the platform tier");
  assert.equal(schedule[6].amountKobo, MONTHLY_FEE_KOBO);
});

test("month counting, phases and the next payment all agree", () => {
  const started = new Date("2026-01-10T00:00:00Z");
  assert.equal(currentMonthIndex(started, new Date("2026-01-09T00:00:00Z")), 0, "before it starts");
  assert.equal(currentMonthIndex(started, new Date("2026-01-10T00:00:00Z")), 1);
  assert.equal(currentMonthIndex(started, new Date("2026-03-10T00:00:00Z")), 3);
  assert.equal(currentPhase(started, new Date("2026-03-10T00:00:00Z")), "setup");
  assert.equal(currentPhase(started, new Date("2026-07-10T00:00:00Z")), "platform");
  assert.equal(monthsUntilPlatformPhase(started, new Date("2026-01-11T00:00:00Z")), 6);
  assert.equal(monthsUntilPlatformPhase(started, new Date("2026-04-10T00:00:00Z")), 3);
  assert.equal(monthsUntilPlatformPhase(started, new Date("2026-07-10T00:00:00Z")), 0);

  const next = nextPaymentDue(started, new Date("2026-02-11T00:00:00Z"));
  assert.equal(next?.monthIndex, 3, "month 2 is paid; month 3 is next");
});

test("first-year value is the six instalments plus six months of the tier", () => {
  assert.equal(totalContractValue(6), SETUP_FEE_KOBO, "the first six months are exactly the package");
  assert.equal(totalContractValue(12), SETUP_FEE_KOBO + 6 * MONTHLY_FEE_KOBO);
  assert.equal(totalContractValue(0), 0);
  const average = averageMonthlyKobo(12);
  assert.equal(average, Math.round((SETUP_FEE_KOBO + 6 * MONTHLY_FEE_KOBO) / 12));
  assert.ok(average > MONTHLY_FEE_KOBO, "the first year averages above the platform tier");
});

test("cancel anytime is real: unbilled instalments are simply never billed", () => {
  const started = new Date("2026-01-10T00:00:00Z");

  const month3 = cancellationSummary(started, new Date("2026-03-10T00:00:00Z"));
  assert.equal(month3.monthsBilled, 2, "two payments collected by the time month 3 begins");
  assert.equal(month3.collectedKobo, 2 * 10_833_334);
  assert.equal(month3.unbilledSetupKobo, SETUP_FEE_KOBO - month3.collectedKobo, "what the no-lock-in promise writes off");
  assert.equal(month3.insideSetupWindow, true);

  const afterPackage = cancellationSummary(started, new Date("2026-08-10T00:00:00Z"));
  assert.equal(afterPackage.monthsBilled, 7);
  assert.equal(afterPackage.unbilledSetupKobo, 0, "the package is fully recovered");
  assert.equal(afterPackage.insideSetupWindow, false);
});

test("break-even moves with the phase, and the console must say so", () => {
  // During the instalments the clinic needs five N25,000 consultations; on the
  // N59,000 tier it drops to three. Quoting only the second number while the
  // first is being billed would be the most misleading figure in the product.
  assert.equal(breakEvenBookings(amountForMonth(1), 2_500_000), 5);
  assert.equal(breakEvenBookings(MONTHLY_FEE_KOBO, 2_500_000), 3);
  assert.equal(breakEvenBookings(0, 2_500_000), 0);
  assert.equal(breakEvenBookings(MONTHLY_FEE_KOBO, 0), 0);
});

test("a typical booking conversation costs ₦5–₦10 in model usage", () => {
  const cost = typicalSessionCostKobo();
  assert.ok(cost >= 500, `expected at least ₦5 (500 kobo), got ${cost}`);
  assert.ok(cost <= 1000, `expected at most ₦10 (1000 kobo), got ${cost}`);
  // The documented session profile and the function must agree — the sales
  // claim is about this specific conversation shape, not a generic one.
  assert.equal(cost, aiUsageCostKobo(TYPICAL_SESSION_USAGE));
  assert.equal(TYPICAL_SESSION_USAGE.cachedInputTokens, 14_400);
});

test("cache hits are cheaper than cache misses, and usage is counted per bucket", () => {
  const miss = aiUsageCostKobo({ inputTokens: 10_000, outputTokens: 0 });
  const hit = aiUsageCostKobo({ inputTokens: 0, cachedInputTokens: 10_000, outputTokens: 0 });
  assert.ok(hit < miss, "cached input must bill below full-rate input");
  assert.equal(aiUsageCostKobo({ inputTokens: 0, outputTokens: 0 }), 0);
  // Cost rounds up, never down — a margin must not drift optimistic.
  assert.ok(aiUsageCostKobo({ inputTokens: 1, outputTokens: 0 }) >= 1);
});

test("the subscription layer clears a 95% gross margin at realistic volume", () => {
  const costPerSession = typicalSessionCostKobo();
  for (const sessionsPerMonth of [10, 50, 100, 260]) {
    const econ = subscriptionEconomics({ monthlyFeeKobo: MONTHLY_FEE_KOBO, sessionsPerMonth, costPerSessionKobo: costPerSession });
    assert.ok(
      econ.grossMargin >= 0.95,
      `${sessionsPerMonth} sessions/month gives ${(econ.grossMargin * 100).toFixed(1)}% margin, below the 95% claim`,
    );
    assert.ok(econ.grossProfitKobo > 0);
  }
});

test("the margin claim has a stated volume ceiling, and it is generous but finite", () => {
  const ceiling = sessionsAtMargin();
  assert.ok(Number.isFinite(ceiling));
  // 5% of ₦59,000 is ₦2,950; at ~₦9 a conversation that is a few hundred
  // chats a month — far beyond a single clinic's front desk, and stated
  // rather than hidden.
  assert.ok(ceiling >= 200, `95% margin should survive at least 200 chats/month, got ${ceiling}`);
  // At the ceiling the claim holds; beyond it, margin genuinely falls.
  const atCeiling = subscriptionEconomics({
    monthlyFeeKobo: MONTHLY_FEE_KOBO,
    sessionsPerMonth: ceiling,
    costPerSessionKobo: typicalSessionCostKobo(),
  });
  assert.ok(atCeiling.grossMargin >= 0.95);
  const beyond = subscriptionEconomics({
    monthlyFeeKobo: MONTHLY_FEE_KOBO,
    sessionsPerMonth: ceiling * 4,
    costPerSessionKobo: typicalSessionCostKobo(),
  });
  assert.ok(beyond.grossMargin < 0.95, "the model does not pretend the claim is unbounded");
  assert.ok(beyond.grossProfitKobo > 0, "but it is still profitable");
});

test("grossMargin is clamped to [0,1] and safe at zero revenue", () => {
  assert.equal(grossMargin(0, 100), 0);
  assert.equal(grossMargin(100, 0), 1);
  assert.equal(grossMargin(100, 500), 0);
});

/* ------------------------------------------------------------------ */
/* The ROI pitch                                                       */
/* ------------------------------------------------------------------ */

test("the blueprint's headline ROI numbers hold", () => {
  const roi = clinicRoi();
  assert.equal(roi.dailyLossKobo, 7_500_000, "3 missed calls x N25,000 = N75,000/day");
  assert.equal(roi.monthlyLossKobo, 195_000_000, "N195,000/month at 26 working days");
  assert.equal(roi.bookingsToBreakEven, 3, "3 recovered patients pay off N59,000");
  assert.ok(roi.netGainKobo > 0, "the clinic is net positive on conservative assumptions");
});

test("the ROI pitch is honest about the instalment phase", () => {
  // Against N108,333 while the package is being paid off, the bar is five
  // recovered patients a month, not three.
  const duringSetup = clinicRoi({ monthlyFeeKobo: amountForMonth(1) });
  assert.equal(duringSetup.bookingsToBreakEven, 5);
  assert.ok(duringSetup.netGainKobo > 0, "still net positive at the conservative baseline");

  const afterSetup = clinicRoi({ monthlyFeeKobo: MONTHLY_FEE_KOBO });
  assert.equal(afterSetup.bookingsToBreakEven, 3);
  assert.ok(afterSetup.netGainKobo > duringSetup.netGainKobo, "the platform phase is the easier sell");
});

test("the ROI calculator scales with the inputs a director actually argues about", () => {
  const conservative = clinicRoi({ missedCallsPerDay: 1, recoveryRate: 0.1 });
  const aggressive = clinicRoi({ missedCallsPerDay: 10, recoveryRate: 0.35 });
  assert.ok(aggressive.recoveredValueKobo > conservative.recoveredValueKobo);
  // Even at one missed call a day and a 10% recovery rate, the subscription
  // must still pay for itself — otherwise the tool is only useful in a pitch.
  assert.ok(conservative.netGainKobo > 0, "conservative case still net positive");
  assert.equal(clinicRoi({ averageConsultValueKobo: 0 }).bookingsToBreakEven, 0);
});

test("roi defaults match the constants the calculator is documented with", () => {
  assert.equal(DEFAULT_CLINIC_ROI_INPUT.averageConsultValueKobo, 2_500_000);
  assert.equal(DEFAULT_CLINIC_ROI_INPUT.missedCallsPerDay, 3);
  assert.equal(DEFAULT_CLINIC_ROI_INPUT.monthlyFeeKobo, MONTHLY_FEE_KOBO);
});

test("valuation math is in kobo and internally consistent", () => {
  const arr = arrKobo(1000);
  assert.equal(arr, Math.round(1000 * MONTHLY_FEE_KOBO * 12));
  const range = valuationRangeKobo(arr);
  assert.ok(range.lowKobo < range.highKobo);
  assert.equal(range.lowKobo, arr * 10);
  assert.equal(range.highKobo, arr * 15);
  const clinics = clinicsForValuation();
  assert.ok(clinics > 100_000, `$1B needs a lot of clinics — got ${clinics}`);
  assert.ok(Number.isFinite(clinics));
});

/* ------------------------------------------------------------------ */
/* Packs                                                               */
/* ------------------------------------------------------------------ */

test("there is one well-formed pack per blueprint vertical plus a general fallback", () => {
  assert.equal(INDUSTRY_PACKS.length, 4);
  const ids = INDUSTRY_PACKS.map((p) => p.id);
  assert.deepEqual(new Set(ids).size, ids.length, "pack ids are unique");
  for (const id of ["mens_health", "aesthetics", "elderly_care", "general"]) {
    assert.ok(ids.includes(id), `missing pack ${id}`);
  }
});

test("business type maps to the right pack and unknown types fall back safely", () => {
  assert.equal(packForBusinessType("mens_health").id, "mens_health");
  assert.equal(packForBusinessType("aesthetics").id, "aesthetics");
  assert.equal(packForBusinessType("elderly_care").id, "elderly_care");
  assert.equal(packForBusinessType("salon").id, "general");
  assert.equal(packForBusinessType(undefined).id, "general");
  assert.equal(getPack("nonsense").id, "general");
  assert.equal(getPack("elderly_care").id, "elderly_care");
});

test("every pack is complete enough to run a conversation", () => {
  for (const pack of INDUSTRY_PACKS) {
    assert.ok(pack.persona.length > 20, `${pack.id}: persona`);
    assert.ok(pack.tone.length >= 2, `${pack.id}: tone rules`);
    assert.ok(pack.privacy.length > 20, `${pack.id}: privacy statement`);
    assert.ok(pack.neverSay.length >= 3, `${pack.id}: guardrails`);
    assert.ok(pack.services.length >= 3, `${pack.id}: services`);
    assert.ok(pack.intakeFields.length >= 2, `${pack.id}: intake fields`);
    assert.ok(pack.bookingPolicy.length > 20, `${pack.id}: booking policy`);
    assert.match(pack.smsTemplate, /\{link\}/, `${pack.id}: SMS template needs a tracking link`);
    assert.match(pack.defaultGreeting, /\{business\}/, `${pack.id}: greeting needs the business name`);
    assert.ok(pack.returningGreeting.length > 10, `${pack.id}: needs a returning-patient line`);
    assert.ok(pack.triageRules.length >= 2, `${pack.id}: triage rules`);
  }
});

test("every triage rule is uniquely identified, matchable and actionable", () => {
  const validSeverity = new Set(["emergency", "urgent", "caution"]);
  const validAction = new Set(["call_emergency", "handoff_now", "flag_for_review"]);
  for (const pack of INDUSTRY_PACKS) {
    const seen = new Set();
    for (const rule of pack.triageRules) {
      assert.ok(!seen.has(rule.id), `${pack.id}: duplicate rule id ${rule.id}`);
      seen.add(rule.id);
      assert.ok(validSeverity.has(rule.severity), `${rule.id}: bad severity`);
      assert.ok(validAction.has(rule.action), `${rule.id}: bad action`);
      assert.ok(rule.label.length > 5, `${rule.id}: needs a label staff can read`);
      assert.ok(rule.response.length > 30, `${rule.id}: needs a real patient-facing response`);
      assert.ok((rule.phrases?.length ?? 0) + (rule.patterns?.length ?? 0) > 0, `${rule.id}: nothing to match on`);
      for (const source of rule.patterns ?? []) {
        assert.doesNotThrow(() => new RegExp(source, "i"), `${rule.id}: invalid pattern`);
      }
    }
  }
});

test("each clinical pack screens for real emergencies, and every emergency rule points at emergency care", () => {
  for (const id of ["mens_health", "aesthetics", "elderly_care"]) {
    const pack = getPack(id);
    const emergencies = pack.triageRules.filter((r) => r.severity === "emergency");
    assert.ok(emergencies.length >= 3, `${id}: needs at least three emergency rules, has ${emergencies.length}`);
    for (const rule of emergencies) {
      assert.equal(rule.action, "call_emergency", `${rule.id}: emergencies tell the patient to seek care`);
      assert.ok(rule.response.includes(EMERGENCY_NUMBER), `${rule.id}: must give the emergency number`);
    }
  }
});

test("no pack promises a prescription, a diagnosis or a guaranteed result", () => {
  for (const pack of INDUSTRY_PACKS) {
    const guardrails = pack.neverSay.join(" ").toLowerCase();
    assert.ok(
      guardrails.includes("never") || guardrails.includes("do not"),
      `${pack.id}: guardrails must be prohibitions`,
    );
  }
  const clinical = ["mens_health", "aesthetics", "elderly_care"].map(getPack);
  for (const pack of clinical) {
    const guardrails = pack.neverSay.join(" ").toLowerCase();
    assert.ok(guardrails.includes("prescrib") || guardrails.includes("dose"), `${pack.id}: must forbid prescribing/dosing`);
    assert.ok(guardrails.includes("diagnos"), `${pack.id}: must forbid diagnosing`);
  }
});

/* ------------------------------------------------------------------ */
/* Triage screening                                                    */
/* ------------------------------------------------------------------ */

const mens = getPack("mens_health").triageRules;
const aes = getPack("aesthetics").triageRules;
const elderly = getPack("elderly_care").triageRules;

test("normalisation folds case, curly apostrophes and whitespace", () => {
  assert.equal(normalizeForScreening("  I CAN\u2019T   Breathe "), "i can't breathe");
});

test("mens health: priapism is an emergency, however the patient words the duration", () => {
  for (const text of [
    "I've had an erection lasting 5 hours",
    "erection for 6 hours and it hurts",
    "it has been 4 hours and I am still hard",
    "painful erection since last night",
  ]) {
    const result = screenMessage(text, mens);
    assert.equal(result.severity, "emergency", `should be emergency: "${text}"`);
    assert.equal(result.rule.id, "mh-priapism");
    assert.ok(requiresEmergencyServices(result.severity));
    assert.ok(result.response.includes("112"));
  }
});

test("mens health: a nitrate/ED interaction question is treated as an emergency, not a booking", () => {
  const result = screenMessage("I take nitrate tablets for my heart, can I use sildenafil?", mens);
  assert.equal(result.severity, "emergency");
  assert.ok(requiresHandoff(result.severity));
});

test("mens health: testicular pain, penile injury and self-harm all stop the booking flow", () => {
  assert.equal(screenMessage("sudden testicle pain and one testicle swollen", mens).severity, "emergency");
  assert.equal(screenMessage("I heard a snap during sex and now my penis is swollen", mens).severity, "emergency");
  assert.equal(screenMessage("honestly I want to die", mens).severity, "emergency");
});

test("a negated symptom does not fire", () => {
  const noChestPain = screenMessage("no chest pain", mens);
  assert.equal(noChestPain.matched, false, "'no chest pain' must not be an emergency");
  const denies = screenMessage("patient denies chest pain", mens);
  assert.equal(denies.matched, false);
});

test("negation is scoped per rule: 'no chest pain but can't breathe' still escalates the breathing", () => {
  const result = screenMessage("no chest pain, but she can't breathe and her lips look blue", elderly);
  assert.equal(result.matched, true);
  assert.equal(result.rule.id, "ec-chest-pain-breathless");
});

test("elderly care: stroke, falls on blood thinners and delirium are emergencies", () => {
  assert.equal(screenMessage("her face is drooping and her speech is slurred", elderly).rule.id, "ec-stroke-fast");
  assert.equal(screenMessage("he fell and banged his head, he is on warfarin", elderly).severity, "emergency");
  assert.equal(screenMessage("she is more confused today and very drowsy", elderly).severity, "emergency");
});

test("elderly care: medication changes are handed to a human, never answered", () => {
  const result = screenMessage("should we stop the medication or double the dose?", elderly);
  assert.equal(result.rule.id, "ec-medication-change");
  assert.equal(result.action, "handoff_now");
  assert.ok(requiresHandoff(result.severity));
});

test("aesthetics: vascular occlusion and anaphylaxis are emergencies", () => {
  const occlusion = screenMessage("after my filler my skin is turning white and I can't see properly", aes);
  assert.equal(occlusion.rule.id, "ae-vascular-occlusion");
  assert.ok(requiresEmergencyServices(occlusion.severity));

  const anaphylaxis = screenMessage("my lips are swelling and I can't breathe after the treatment", aes);
  assert.equal(anaphylaxis.severity, "emergency");
});

test("aesthetics: pregnancy is a caution, not an emergency, but it is still flagged", () => {
  const result = screenMessage("I am pregnant — can I still get filler?", aes);
  assert.equal(result.rule.id, "ae-pregnancy-injectables");
  assert.equal(result.severity, "caution");
  assert.equal(requiresHandoff(result.severity), false, "caution lets the chat continue");
  assert.equal(result.action, "flag_for_review");
});

test("the most severe match wins when several rules fire at once", () => {
  const result = screenMessage("I am pregnant and my skin is turning white after filler and I can't see", aes);
  assert.equal(result.severity, "emergency");
  assert.ok(result.allMatches.length >= 2, "every fired rule is recorded for audit");
  assert.ok(result.allMatches.some((r) => r.id === "ae-pregnancy-injectables"));
  assert.equal(result.allMatches[0].severity, "emergency", "most severe is first");
});

test("matching is reported for audit, with the phrase that tripped it", () => {
  const result = screenMessage("I've had an erection lasting 5 hours", mens);
  assert.equal(result.matchedBy, "phrase");
  assert.ok(result.matchedText.length > 0);
});

test("triage can be switched off explicitly, and empty input is safe", () => {
  assert.equal(screenMessage("chest pain", mens, { enabled: false }).matched, false);
  assert.equal(screenMessage("", mens).matched, false);
  assert.equal(screenMessage(null, mens).matched, false);
});

test("a malformed pattern in a pack cannot break screening", () => {
  const broken = [{ id: "broken", label: "Broken rule", severity: "urgent", action: "handoff_now", phrases: ["unicorn"], patterns: ["([unclosed"], response: "Handled." }];
  assert.doesNotThrow(() => screenMessage("there is a unicorn here", broken));
  assert.equal(screenMessage("there is a unicorn here", broken).matched, true, "phrases still work");
});

test("emergency responses never tell the patient to wait for a callback", () => {
  for (const pack of INDUSTRY_PACKS) {
    for (const rule of pack.triageRules.filter((r) => r.severity === "emergency")) {
      const lower = rule.response.toLowerCase();
      assert.ok(!/wait for (a|the) (callback|call back|appointment)/.test(lower), `${rule.id}: must not defer to a callback`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* SMS composition                                                     */
/* ------------------------------------------------------------------ */

test("{name} renders as a first name or disappears cleanly", () => {
  const template = "Hi{name}, sorry we missed your call.";
  assert.equal(renderTemplate(template, { name: " Chioma" }), "Hi Chioma, sorry we missed your call.");
  assert.equal(renderTemplate(template, { name: "" }), "Hi, sorry we missed your call.");
});

test("renderSms uses only the first name and fills the business and link", () => {
  const body = renderSms({
    template: "{business}: sorry we missed your call. Book here: {link}",
    businessName: "Vitalis Men's Clinic",
    patientName: "Chioma Okafor",
    link: "https://jktl.com.ng/chat?id=abc",
  });
  assert.equal(body, "Vitalis Men's Clinic: sorry we missed your call. Book here: https://jktl.com.ng/chat?id=abc");
  assert.ok(!body.includes("Okafor"), "surname is not needed in a callback SMS");
  assert.ok(!body.includes("{"), "no unfilled placeholders");
});

test("unknown placeholders are left visible rather than silently blanked", () => {
  assert.equal(renderTemplate("Hello {nope}", {}), "Hello {nope}");
});

test("segment counting matches how networks bill", () => {
  assert.equal(smsSegments("a".repeat(160)).segments, 1);
  assert.equal(smsSegments("a".repeat(161)).segments, 2, "one character over is a second segment");
  // Multipart messages carry a header on every segment, so each holds 153,
  // not 160 — 2 segments hold 306 characters, and 307 needs a third.
  assert.equal(smsSegments("a".repeat(306)).segments, 2);
  assert.equal(smsSegments("a".repeat(307)).segments, 3);
  assert.equal(smsSegments("a".repeat(160)).encoding, "gsm7");
});

test("characters outside GSM-7 collapse the budget to UCS-2 — and the count reflects it", () => {
  // Two messages that differ by one character: ₦ is not in the GSM-7
  // alphabet, so the whole message drops to 70-character UCS-2 segments.
  const ascii = "x".repeat(120);
  const withNaira = "₦" + "x".repeat(119);
  assert.equal(smsSegments(ascii).encoding, "gsm7");
  assert.equal(smsSegments(ascii).segments, 1, "120 GSM-7 characters fit one segment");

  const measured = smsSegments(withNaira);
  assert.equal(measured.encoding, "ucs2");
  assert.equal(measured.length, 120);
  assert.equal(measured.segments, 2, "the same 120 characters cost two UCS-2 segments");
});

test("GSM-7 extension characters count as two septets", () => {
  // "{" lives in the extension table.
  assert.equal(smsSegments("{".repeat(80)).length, 160);
  assert.equal(smsSegments("{".repeat(80)).segments, 1);
  assert.equal(smsSegments("{".repeat(81)).segments, 2);
});

test("wallet cost is per segment, at the contract unit price", () => {
  assert.equal(smsCostKobo(1, SMS_UNIT_COST_KOBO), 450);
  assert.equal(smsCostKobo(3, SMS_UNIT_COST_KOBO), 1350);
  assert.equal(smsCostKobo(0, SMS_UNIT_COST_KOBO), 0);
});

test("the tracking link carries the session and the phone, URL-encoded", () => {
  const link = buildChatLink("https://jktl.com.ng/", "sess-123", "+2348034412291");
  assert.equal(link, "https://jktl.com.ng/chat?id=sess-123&phone=%2B2348034412291");
  const noPhone = buildChatLink("https://jktl.com.ng", "sess-123", "");
  assert.equal(noPhone, "https://jktl.com.ng/chat?id=sess-123");
});

test("every pack's real SMS fits in a sensible number of segments", () => {
  for (const pack of INDUSTRY_PACKS) {
    const body = renderSms({
      template: pack.smsTemplate,
      businessName: "Vitalis Men's Health & Fertility Clinic",
      patientName: "Chioma",
      link: buildChatLink("https://jktl.com.ng", "1f3c9d2a-4b6e-4f0a-9c1d-2e3f4a5b6c7d", "+2348034412291"),
    });
    const measured = smsSegments(body);
    assert.ok(measured.segments <= 2, `${pack.id}: callback SMS is ${measured.segments} segments (${measured.length} chars)`);
  }
});

/* ------------------------------------------------------------------ */
/* The whole intercept, end to end, with no network or database        */
/* ------------------------------------------------------------------ */

test("a missed call to a men's clinic produces a discreet SMS and an escalated chat", () => {
  const pack = packForBusinessType("mens_health");
  const link = buildChatLink("https://jktl.com.ng", "sess-1", "+2348030000000");
  const sms = renderSms({ template: pack.smsTemplate, businessName: "Vitalis Clinic", patientName: "Emeka", link });

  // Discreet: the SMS must not reveal why he called or what he might need.
  const lower = sms.toLowerCase();
  for (const word of ["erection", "testosterone", "std", "sti", "fertility", "dysfunction", "sexual"]) {
    assert.ok(!lower.includes(word), `callback SMS leaks "${word}"`);
  }
  assert.ok(sms.includes(link));

  // And when he replies with a red flag, the deterministic screen catches it
  // before any model is involved.
  const screen = screenMessage("it has been 5 hours and I am still hard", pack.triageRules);
  assert.equal(screen.severity, "emergency");
  const cost = smsCostKobo(smsSegments(sms).segments, SMS_UNIT_COST_KOBO);
  assert.ok(cost > 0 && cost <= 900, `SMS should cost at most ₦9, got ${cost} kobo`);
});

/* ------------------------------------------------------------------ */
/* Prompt construction                                                 */
/* ------------------------------------------------------------------ */

const mensPack = getPack("mens_health");

function promptFor(overrides = {}) {
  return buildSystemPrompt({
    businessName: "Vitalis Men's Health",
    pack: mensPack,
    services: [{ name: "Confidential consultation", priceKobo: 2_500_000, durationMin: 30 }],
    phone: "0803 441 2291",
    address: "14 Swali Road",
    city: "Yenagoa",
    state: "Bayelsa",
    openingLine: "Welcome back, Emeka.",
    patientName: "Emeka Obi",
    visitingBefore: true,
    escalationPhone: "0803 000 1111",
    autoBook: true,
    channel: "missed_call_sms",
    now: new Date("2026-03-04T09:15:00Z"),
    ...overrides,
  });
}

test("the returning-patient greeting is the context-preservation line from the blueprint", () => {
  const greeting = buildGreeting({ customGreeting: "", pack: mensPack, businessName: "Vitalis", patientName: "Chioma Okafor" });
  assert.ok(greeting.startsWith("Welcome back, Chioma."), greeting);
  assert.ok(!greeting.includes("Okafor"), "first name only — this is a chat, not a letter");
});

test("an unknown patient gets the pack's own greeting, filled in", () => {
  const greeting = buildGreeting({ customGreeting: "", pack: mensPack, businessName: "Vitalis", patientName: "" });
  assert.ok(greeting.includes("Vitalis"));
  assert.ok(!greeting.includes("Welcome back"));
  assert.ok(!greeting.includes("{"), "no unfilled placeholders");
});

test("a clinic's custom greeting overrides the pack default", () => {
  const greeting = buildGreeting({
    customGreeting: "Hello{name}, you have reached {business}.",
    pack: mensPack,
    businessName: "Vitalis",
    patientName: "Chioma",
  });
  assert.equal(greeting, "Hello Chioma, you have reached Vitalis.");
});

test("the system prompt carries the clinic's real facts, not placeholders", () => {
  const prompt = promptFor();
  assert.ok(prompt.includes("Vitalis Men's Health"));
  assert.ok(prompt.includes("Confidential consultation"));
  assert.ok(prompt.includes("NGN 25,000"), "prices are shown to the model in the clinic's currency");
  assert.ok(prompt.includes("14 Swali Road, Yenagoa, Bayelsa"));
  assert.ok(prompt.includes("0803 441 2291"));
  assert.ok(prompt.includes("2026-03-04T09:15:00.000Z"), "the model needs the current time to resolve 'tomorrow'");
  assert.ok(prompt.includes("Emeka Obi"), "a returning patient is named in the prompt");
});

test("the prompt states every hard guardrail, verbatim and in full", () => {
  const prompt = promptFor();
  for (const rule of mensPack.neverSay) {
    assert.ok(prompt.includes(rule), `guardrail missing from prompt: ${rule}`);
  }
  assert.ok(prompt.includes("Never claim to be a clinician"));
  assert.ok(/never give medical advice/i.test(prompt));
});

test("the prompt lists the red flags and demands the emergency number, not a callback", () => {
  const prompt = promptFor();
  assert.ok(prompt.includes("Erection lasting more than four hours"));
  assert.ok(prompt.includes("112"), "the emergency number must be in the instructions");
  assert.ok(/never tell a patient with an emergency to wait for a callback/i.test(prompt));
  assert.ok(prompt.includes("0803 000 1111"), "the clinic's escalation line is given to the model as staff context");
  assert.ok(/must not be told to wait/i.test(prompt));
});

test("the prompt warns the model off inventing opening hours and prices", () => {
  const prompt = promptFor();
  assert.ok(/do not state them/i.test(prompt));
  assert.ok(/never invent a price/i.test(prompt));
});

test("auto_book decides whether the booking tool and instructions exist", () => {
  const withBooking = buildTools(mensPack, { autoBook: true }).map((t) => t.function.name);
  const withoutBooking = buildTools(mensPack, { autoBook: false }).map((t) => t.function.name);
  assert.ok(withBooking.includes("book_appointment"));
  assert.ok(!withoutBooking.includes("book_appointment"));
  for (const names of [withBooking, withoutBooking]) {
    assert.ok(names.includes("handoff_to_human"), "a human handoff must always be available");
    assert.ok(names.includes("finish_conversation"));
  }
  assert.ok(/you cannot write bookings/i.test(promptFor({ autoBook: false })));
});

test("the widget channel is described differently from the missed-call channel", () => {
  const sms = promptFor({ channel: "missed_call_sms" });
  const widget = promptFor({ channel: "website_widget" });
  assert.ok(/call was missed/i.test(sms));
  assert.ok(/website chat directly/i.test(widget));
});

test("every tool schema is a well-formed function definition", () => {
  for (const tool of buildTools(mensPack, { autoBook: true })) {
    assert.equal(tool.type, "function");
    assert.ok(tool.function.name.length > 3);
    assert.ok(tool.function.description.length > 20);
    assert.equal(tool.function.parameters.type, "object");
    assert.ok(Array.isArray(tool.function.parameters.required));
    for (const key of tool.function.parameters.required) {
      assert.ok(key in tool.function.parameters.properties, `${tool.function.name}: required field ${key} has no schema`);
    }
  }
});
