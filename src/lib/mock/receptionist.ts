import { ORG_ID, demoProfile } from "./business";
import { packForBusinessType } from "@/lib/ai/industry-packs";
import {
  FREE_CREDIT_KOBO,
  MONTHLY_FEE_KOBO,
  SETUP_FEE_KOBO,
  SETUP_MONTHLY_KOBO,
  SETUP_MONTHS,
  SMS_UNIT_COST_KOBO,
} from "@/lib/ai/pricing";
import type {
  AiReceptionistConfig,
  ChatSession,
  MissedCall,
  MissedCallStatus,
  ReceptionistContract,
  ReceptionistOverview,
  ReceptionistStats,
  WalletSnapshot,
  WalletTransaction,
} from "@/lib/ai/types";

/**
 * Demo-mode receptionist data.
 *
 * Demo mode never touches the database, so without this the console — the
 * most commercially interesting screen in the product — would be an empty
 * shell for anyone who clicked "Open salon demo". These numbers are shaped to
 * be *realistic rather than flattering*: a 26% recovery rate, two failed
 * sends, one wallet-blocked call, and one emergency escalation, because those
 * are the states a clinic actually needs to understand before trusting the
 * thing with its phone line.
 *
 * Everything the console computes from these rows (ROI, margin, wallet
 * runway) is computed with the same `src/lib/ai/pricing.ts` functions the
 * live console uses — the demo exercises the real arithmetic.
 */

const DAY = 24 * 60 * 60 * 1000;

function ago(days: number, hours = 0): string {
  return new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000).toISOString();
}

function call(
  id: string,
  callerPhone: string,
  status: MissedCallStatus,
  daysAgo: number,
  hoursAgo = 0,
  extra: Partial<MissedCall> = {},
): MissedCall {
  return {
    id,
    organizationId: ORG_ID,
    callerPhone,
    calledNumber: "0700 000 1234",
    provider: "termii",
    providerCallId: `demo-call-${id}`,
    receivedAt: ago(daysAgo, hoursAgo),
    status,
    customerId: null,
    chatSessionId: null,
    smsBody: "",
    smsUnits: 1,
    smsCostKobo: status === "sms_failed" || status === "sms_blocked" ? 0 : SMS_UNIT_COST_KOBO,
    smsSentAt: status === "sms_failed" || status === "sms_blocked" ? null : ago(daysAgo, hoursAgo),
    smsError: "",
    recoveredBookingId: null,
    recoveredValueKobo: 0,
    notes: "",
    createdAt: ago(daysAgo, hoursAgo),
    ...extra,
  };
}

export function demoReceptionistConfig(): AiReceptionistConfig {
  const profile = demoProfile();
  return {
    organizationId: ORG_ID,
    enabled: true,
    packId: packForBusinessType(profile.businessType).id,
    voiceNumber: "0700 000 1234",
    smsSenderId: "JKTL",
    greeting: "",
    escalationPhone: profile.phone,
    escalationEmail: profile.email,
    triageEnabled: true,
    autoBook: true,
    averageConsultValueKobo: 2_500_000,
    quietHoursStart: "21:30",
    quietHoursEnd: "07:30",
  };
}

export function demoWallet(): WalletSnapshot {
  // Part-way through the free allocation, which is the state worth showing:
  // the clinic can see free credit being spent, and how much is left.
  const freeKobo = 620_000;
  const paidKobo = 615_000;
  const balanceKobo = freeKobo + paidKobo;
  return {
    balanceKobo,
    freeKobo,
    paidKobo,
    freeExhausted: false,
    hasToppedUp: true,
    lowBalanceThresholdKobo: 225_000,
    smsUnitCostKobo: SMS_UNIT_COST_KOBO,
    whatsappUnitCostKobo: 700,
    isLow: false,
    smsRemaining: Math.floor(balanceKobo / SMS_UNIT_COST_KOBO),
    freeSmsRemaining: Math.floor(freeKobo / SMS_UNIT_COST_KOBO),
  };
}

export function demoContract(): ReceptionistContract {
  // Two months in: the clinic has paid the first two instalments of the
  // ₦650,000 package and is inside the amortisation window, which is the state
  // that shows the model off best — schedule, next payment and the cost of
  // cancelling today are all visible.
  const startedAt = ago(64);
  const billing = new Date(startedAt);
  billing.setUTCMonth(billing.getUTCMonth() + 6);
  return {
    organizationId: ORG_ID,
    setupFeeKobo: SETUP_FEE_KOBO,
    setupMonths: SETUP_MONTHS,
    setupMonthlyKobo: SETUP_MONTHLY_KOBO,
    monthlyFeeKobo: MONTHLY_FEE_KOBO,
    startedAt,
    setupPaymentRef: "demo-instalment-1",
    includedTokenCreditKobo: FREE_CREDIT_KOBO,
    billingStartsAt: billing.toISOString(),
    nextChargeAt: ago(4),
    lastChargeAt: ago(34),
    chargesPaid: 2,
    hasCard: true,
    cardBrand: "Visa",
    cardLast4: "4081",
    cardExpMonth: "09",
    cardExpYear: "2029",
    autoChargeEnabled: true,
    lastChargeError: "",
    lastChargeAttemptAt: ago(4),
    status: "active",
    cancelledAt: null,
    cancelReason: "",
    notes: "Demo contract — six instalments of ₦108,333.33, then ₦59,000 a month, cancellable anytime.",
  };
}

export function demoReceptionistStats(): ReceptionistStats {
  const missedCalls = 42;
  const bookings = 11;
  return {
    windowDays: 30,
    missedCalls,
    smsSent: 39,
    smsFailed: 2,
    smsBlocked: 1,
    chatsOpened: 31,
    bookings,
    recoveredValueKobo: bookings * 2_500_000,
    smsCostKobo: 39 * SMS_UNIT_COST_KOBO,
    aiCostKobo: 31 * 900,
    recoveryRate: bookings / missedCalls,
  };
}

export function demoMissedCalls(): MissedCall[] {
  const sent = "Glam Hair Studio: sorry we missed your call. Book with our assistant here: https://jktl.com.ng/chat?id=demo";
  return [
    call("mc_1", "0803 441 2291", "recovered", 0, 2, {
      customerId: "cus_1",
      chatSessionId: "cs_1",
      smsBody: sent,
      recoveredValueKobo: 2_500_000,
      notes: "Booked silk press for Friday — recovered booking recorded by the clinic.",
    }),
    call("mc_2", "0810 552 7741", "booked", 0, 5, { chatSessionId: "cs_2", smsBody: sent, recoveredValueKobo: 2_500_000 }),
    call("mc_3", "0705 118 3390", "chat_opened", 1, 1, { chatSessionId: "cs_3", smsBody: sent }),
    call("mc_4", "0902 774 1120", "sms_sent", 1, 4, { smsBody: sent }),
    call("mc_5", "0806 900 4412", "sms_blocked", 2, 0, {
      smsError: "Communication wallet too low (balance 9,000 kobo, needed 45,000 kobo).",
      notes: "Top up the communication wallet to resume automatic callbacks.",
    }),
    call("mc_6", "0813 220 7788", "booked", 2, 6, { chatSessionId: "cs_4", smsBody: sent, recoveredValueKobo: 3_500_000, customerId: "cus_2" }),
    call("mc_7", "0708 445 1123", "sms_failed", 3, 2, { smsError: "Twilio rejected the message: sender ID not approved.", smsUnits: 1, smsCostKobo: 0 }),
    call("mc_8", "0802 336 9911", "lost", 4, 3, { smsBody: sent, notes: "No response within the follow-up window." }),
    call("mc_9", "0811 660 2244", "chat_opened", 5, 1, { chatSessionId: "cs_5", smsBody: sent, customerId: "cus_3" }),
    call("mc_10", "0703 991 5566", "recovered", 6, 2, { smsBody: sent, recoveredValueKobo: 2_500_000, notes: "Walked in after the callback SMS." }),
  ];
}

export function demoSessions(): ChatSession[] {
  return [
    {
      id: "cs_2",
      organizationId: ORG_ID,
      missedCallId: "mc_2",
      channel: "missed_call_sms",
      visitorPhone: "2348105527741",
      visitorKey: "",
      visitorName: "Chioma Okafor",
      customerId: "cus_1",
      status: "booked",
      escalated: false,
      escalationRuleId: "",
      escalationReason: "",
      escalatedAt: null,
      intent: "book",
      bookingId: "bkg_demo_1",
      packId: "general",
      model: "deepseek-chat",
      tokensIn: 8_400,
      tokensOut: 640,
      cachedTokensIn: 5_100,
      aiCostKobo: 730,
      startedAt: ago(0, 5),
      lastMessageAt: ago(0, 4),
      endedAt: null,
    },
    {
      id: "cs_3",
      organizationId: ORG_ID,
      missedCallId: "mc_3",
      channel: "missed_call_sms",
      visitorPhone: "2347051183390",
      visitorKey: "demo-website-visitor",
      visitorName: "",
      customerId: null,
      status: "active",
      escalated: false,
      escalationRuleId: "",
      escalationReason: "",
      escalatedAt: null,
      intent: "prices",
      bookingId: null,
      packId: "general",
      model: "deepseek-chat",
      tokensIn: 2_100,
      tokensOut: 180,
      cachedTokensIn: 1_400,
      aiCostKobo: 210,
      startedAt: ago(1, 1),
      lastMessageAt: ago(1, 1),
      endedAt: null,
    },
    {
      id: "cs_escalated",
      organizationId: ORG_ID,
      missedCallId: "mc_6",
      channel: "missed_call_sms",
      visitorPhone: "2348132207788",
      visitorKey: "",
      visitorName: "Ngozi Eze",
      customerId: "cus_2",
      status: "handed_off",
      escalated: true,
      escalationRuleId: "gen-medical-emergency",
      escalationReason: "Possible medical emergency",
      escalatedAt: ago(2, 5),
      intent: "gen-medical-emergency",
      bookingId: null,
      packId: "general",
      model: "deepseek-chat",
      tokensIn: 900,
      tokensOut: 90,
      cachedTokensIn: 600,
      aiCostKobo: 95,
      startedAt: ago(2, 6),
      lastMessageAt: ago(2, 5),
      endedAt: null,
    },
  ];
}

export function demoTransactions(): WalletTransaction[] {
  const rows: WalletTransaction[] = [
    {
      id: "tx_1",
      kind: "grant",
      amountKobo: FREE_CREDIT_KOBO,
      freeAmountKobo: FREE_CREDIT_KOBO,
      paidAmountKobo: 0,
      quantity: 1,
      unitCostKobo: 0,
      balanceAfterKobo: FREE_CREDIT_KOBO,
      provider: "jktl",
      providerRef: "free-credit:demo",
      description: "Free communication credit (welcome allocation)",
      missedCallId: null,
      sessionId: null,
      createdAt: ago(52),
    },
    {
      id: "tx_2",
      kind: "topup",
      amountKobo: 1_000_000,
      freeAmountKobo: 0,
      paidAmountKobo: 1_000_000,
      quantity: 1,
      unitCostKobo: 0,
      balanceAfterKobo: 2_500_000,
      provider: "paystack",
      providerRef: "demo-topup-1",
      description: "Communication wallet top-up (card)",
      missedCallId: null,
      sessionId: null,
      createdAt: ago(20),
    },
  ];
  for (let i = 0; i < 8; i += 1) {
    rows.push({
      id: `tx_charge_${i}`,
      kind: "sms",
      amountKobo: -SMS_UNIT_COST_KOBO,
      freeAmountKobo: -SMS_UNIT_COST_KOBO,
      paidAmountKobo: 0,
      quantity: 1,
      unitCostKobo: SMS_UNIT_COST_KOBO,
      balanceAfterKobo: 1_235_000 + i * SMS_UNIT_COST_KOBO,
      provider: "termii",
      providerRef: "",
      description: `Missed-call callback (${i + 1} segment)`,
      missedCallId: `mc_${(i % 10) + 1}`,
      sessionId: null,
      createdAt: ago(i, 3),
    });
  }
  return rows;
}

export function demoReceptionistOverview(): ReceptionistOverview {
  return {
    config: demoReceptionistConfig(),
    wallet: demoWallet(),
    contract: demoContract(),
    stats: demoReceptionistStats(),
    missedCalls: demoMissedCalls(),
    sessions: demoSessions(),
    transactions: demoTransactions(),
    // Demo mode has no provider keys by definition; the console shows the
    // same "not configured" state a real clinic sees before go-live.
    integrations: { messaging: false, deepseek: false },
  };
}
