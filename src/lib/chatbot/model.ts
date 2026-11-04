export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;
export type BotSettings = {
  welcome: string;
  tone: "friendly" | "professional" | "concise";
  color: string;
  avatar: string;
  businessInfo: string;
  whatsapp: string;
  phone: string;
  email: string;
  bookingInstructions: string;
  leadCapture: boolean;
  hideBranding: boolean;
  syncWebsite: boolean;
  customProjectId: string;
};
export const DEFAULT_BOT: BotSettings = {
  welcome: "Hello! I’m your AI assistant. How can I help?",
  tone: "friendly",
  color: "#112055",
  avatar: "",
  businessInfo: "",
  whatsapp: "",
  phone: "",
  email: "",
  bookingInstructions: "",
  leadCapture: true,
  hideBranding: false,
  syncWebsite: false,
  customProjectId: "",
};
export function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error("Please check the information entered.");
  return value.trim();
}
export function uuid(value: unknown) {
  const id = text(value, 36, true);
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))
    throw Error("Invalid identifier.");
  return id;
}
export function settings(value: unknown): BotSettings {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const result = { ...DEFAULT_BOT };
  for (const [key, max] of Object.entries({
    welcome: 500,
    businessInfo: 4000,
    bookingInstructions: 1000,
    customProjectId: 36,
    phone: 40,
    email: 254,
    whatsapp: 20,
    avatar: 2000,
  }))
    if (raw[key] !== undefined)
      (result as unknown as Record<string, unknown>)[key] = text(raw[key], max);
  if (raw.tone !== undefined) {
    if (!["friendly", "professional", "concise"].includes(String(raw.tone)))
      throw Error("Choose an available tone.");
    result.tone = raw.tone as BotSettings["tone"];
  }
  if (raw.color !== undefined) {
    if (!/^#[a-f\d]{6}$/i.test(String(raw.color)))
      throw Error("Choose a valid brand colour.");
    result.color = String(raw.color);
  }
  for (const key of ["leadCapture", "hideBranding", "syncWebsite"] as const)
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "boolean") throw Error("Choose valid settings.");
      result[key] = raw[key];
    }
  if (result.customProjectId) uuid(result.customProjectId);
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw Error("Enter a valid email.");
  if (result.whatsapp && !/^\+?[1-9]\d{6,14}$/.test(result.whatsapp))
    throw Error("Enter a WhatsApp number including its country code.");
  if (result.avatar) {
    const url = new URL(result.avatar);
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("Use an HTTPS avatar image.");
  }
  return result;
}
export function hostname(value: unknown) {
  const name = text(value, 253, true).toLowerCase();
  if (
    !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/.test(name) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(name)
  )
    throw Error("Enter a public hostname without a path or protocol.");
  return name;
}
export function origin(value: string) {
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    if (url.protocol === "https:" && !url.port) return url.origin;
    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return url.origin;
  } catch {}
  return null;
}
export function publicOrigin() {
  return (
    process.env.CHATBOT_PUBLIC_ORIGIN || "https://business.jktl.com.ng"
  ).replace(/\/$/, "");
}
export type Knowledge = { title: string; content: string };
const words = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]{3,}/gu) || [],
  );
export function retrieve(question: string, entries: Knowledge[], limit = 5) {
  const terms = words(question);
  return entries
    .map((entry) => ({
      entry,
      score: [...terms].filter((word) =>
        words(entry.title + " " + entry.content).has(word),
      ).length,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry);
}
export function exactFAQ(question: string, entries: Knowledge[]) {
  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const target = normalize(question);
  return (
    entries.find((entry) => normalize(entry.title) === target)?.content || null
  );
}
export function estimateMicroCost(
  input: number,
  output: number,
  inputRate: number,
  outputRate: number,
) {
  return Math.ceil(input * inputRate + output * outputRate);
}
export function safeError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  for (const known of [
    "CHATBOT_LIMIT",
    "KNOWLEDGE_LIMIT",
    "CHAT_BUSY",
    "CHAT_SESSION_LIMIT",
    "CHAT_SESSION_EXPIRED",
    "CHATBOT_DISABLED",
  ])
    if (code.includes(known)) return known;
  return "REQUEST_FAILED";
}
export type BotRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  settings: unknown;
  enabled: boolean;
  suspended: boolean;
  install_on_builder: boolean;
  revision: number;
  conversations_count: number;
  leads_count: number;
  handoffs_count: number;
};
export type ChatbotEntitlement = Record<string, unknown> & {
  plan_id: string;
  enabled: boolean;
  bots: number;
  responses: number;
  knowledge: number;
  retention_days: number;
  appointments: boolean;
  team_inbox: boolean;
  remove_branding: boolean;
  advanced_leads: boolean;
  analytics: string;
  branding: string;
  monthly_cap_micro_usd: number;
};
