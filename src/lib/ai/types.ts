import type { PackId } from "./industry-packs";

/**
 * Shared shapes for the AI receptionist. Client-safe on purpose (type-only
 * imports, no server-only modules) so the public chat page, the business
 * console and the query layer in `src/lib/db/receptionist.ts` all agree on
 * one definition rather than three drifting ones.
 */

export interface AiReceptionistConfig {
  organizationId: string;
  enabled: boolean;
  packId: PackId;
  /** The Twilio number patients call. */
  voiceNumber: string;
  smsSenderId: string;
  /** Overrides the pack's default greeting when non-empty. */
  greeting: string;
  escalationPhone: string;
  escalationEmail: string;
  triageEnabled: boolean;
  autoBook: boolean;
  /** Used to value a recovered call in the ROI panel. */
  averageConsultValueKobo: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export type MissedCallStatus =
  | "received"
  | "sms_sent"
  | "sms_failed"
  | "sms_blocked"
  | "chat_opened"
  | "booked"
  | "recovered"
  | "lost";

export interface MissedCall {
  id: string;
  organizationId: string;
  callerPhone: string;
  calledNumber: string;
  provider: string;
  providerCallId: string;
  receivedAt: string;
  status: MissedCallStatus;
  customerId: string | null;
  chatSessionId: string | null;
  smsBody: string;
  smsUnits: number;
  smsCostKobo: number;
  smsSentAt: string | null;
  smsError: string;
  recoveredBookingId: string | null;
  recoveredValueKobo: number;
  notes: string;
  createdAt: string;
}

export type ChatSessionStatus = "active" | "booked" | "handed_off" | "closed" | "abandoned";
export type ChatChannel = "missed_call_sms" | "website_widget" | "whatsapp";

export interface ChatSession {
  id: string;
  organizationId: string;
  missedCallId: string | null;
  channel: ChatChannel;
  visitorPhone: string;
  /** Browser-held continuity token for the website widget. Not a credential. */
  visitorKey: string;
  visitorName: string;
  customerId: string | null;
  status: ChatSessionStatus;
  escalated: boolean;
  escalationRuleId: string;
  escalationReason: string;
  escalatedAt: string | null;
  intent: string;
  bookingId: string | null;
  packId: PackId;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  aiCostKobo: number;
  startedAt: string;
  lastMessageAt: string;
  endedAt: string | null;
}

export type ChatMessageRole = "system" | "user" | "assistant" | "tool";

export interface ReceptionistMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  toolName: string;
  createdAt: string;
}

export interface WalletSnapshot {
  balanceKobo: number;
  /** Free credit still available. Spent before any paid balance. */
  freeKobo: number;
  /** Money the clinic actually put in, still available. */
  paidKobo: number;
  /** True once the free allocation has been used up — the moment the console
   * should stop saying "free" and start asking for a top-up. */
  freeExhausted: boolean;
  /** False until the clinic has ever funded the wallet itself. */
  hasToppedUp: boolean;
  lowBalanceThresholdKobo: number;
  smsUnitCostKobo: number;
  whatsappUnitCostKobo: number;
  isLow: boolean;
  /** How many more callback messages the whole balance covers, at one segment
   * each — the number that actually means something to a clinic manager. */
  smsRemaining: number;
  /** ...and how many of those are covered by free credit alone. */
  freeSmsRemaining: number;
}

/** Communication spend only. DeepSeek token cost is JKTL's own cost of
 * goods, tracked on the session as `ai_cost_kobo` — deliberately not
 * something a clinic's wallet pays for. */
export type WalletTransactionKind = "topup" | "grant" | "sms" | "whatsapp" | "voice" | "refund" | "adjustment";

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  /** Signed: positive credits, negative debits. */
  amountKobo: number;
  /** The portion of `amountKobo` drawn from (or added to) free credit. */
  freeAmountKobo: number;
  /** The portion drawn from (or added to) paid balance. Together these two
   * always equal `amountKobo` — enforced by a CHECK on the table. */
  paidAmountKobo: number;
  quantity: number;
  unitCostKobo: number;
  balanceAfterKobo: number;
  provider: string;
  providerRef: string;
  description: string;
  missedCallId: string | null;
  sessionId: string | null;
  createdAt: string;
}

export type ContractStatus = "pending" | "active" | "past_due" | "cancelled";

export interface ReceptionistContract {
  organizationId: string;
  /** ₦650,000, paid over `setupMonths` instalments rather than upfront. */
  setupFeeKobo: number;
  setupMonths: number;
  /** The display figure for one instalment (₦108,333.33). The exact schedule
   * lives in `src/lib/ai/pricing.ts`. */
  setupMonthlyKobo: number;
  /** ₦59,000, from month 7. */
  monthlyFeeKobo: number;
  /** When the contract began — month 1 fell due on this date. */
  startedAt: string | null;
  setupPaymentRef: string;
  includedTokenCreditKobo: number;
  /** Month 7: when the platform tier takes over from the instalments. */
  billingStartsAt: string | null;
  nextChargeAt: string | null;
  lastChargeAt: string | null;
  /** Monthly payments actually collected — the console compares this with the
   * elapsed months and flags a mismatch rather than quietly serving a clinic
   * that stopped paying. */
  chargesPaid: number;
  /** True when a reusable authorization is stored, so the next month can be
   * collected without the clinic doing anything. */
  hasCard: boolean;
  /** Reusable card on file for automatic monthly collection. Empty when none. */
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: string;
  cardExpYear: string;
  autoChargeEnabled: boolean;
  lastChargeError: string;
  lastChargeAttemptAt: string | null;
  status: ContractStatus;
  cancelledAt: string | null;
  cancelReason: string;
  notes: string;
}

/** Roll-up for the console's header tiles and the ROI panel. */
export interface ReceptionistStats {
  windowDays: number;
  missedCalls: number;
  smsSent: number;
  smsFailed: number;
  smsBlocked: number;
  chatsOpened: number;
  bookings: number;
  recoveredValueKobo: number;
  smsCostKobo: number;
  aiCostKobo: number;
  /** bookings / missedCalls, in [0,1]. */
  recoveryRate: number;
}

/** Everything the business console renders in one pass. */
export interface ReceptionistOverview {
  config: AiReceptionistConfig;
  wallet: WalletSnapshot;
  contract: ReceptionistContract | null;
  stats: ReceptionistStats;
  missedCalls: MissedCall[];
  sessions: ChatSession[];
  transactions: WalletTransaction[];
  /** False when the Twilio credentials / DEEPSEEK_API_KEY are missing, so the console
   * can say exactly which integration is not live instead of failing sends
   * quietly in the background. */
  /**
   * Deployment credential flags.
   *
   * No longer rendered on the tenant console — a clinic cannot fix a missing API
   * key, and telling them about one reads as "the thing you bought is broken".
   * The admin overview shows this instead (see `src/lib/integration-health.ts`).
   * Kept on the type because the server still computes it and the field is useful
   * for diagnostics.
   */
  integrations: { messaging: boolean; deepseek: boolean };
}
