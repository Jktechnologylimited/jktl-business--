/** Header-safe single mailbox. Display names, lists and CRLF are not addresses. */
export function mailAddress(raw: unknown): string {
  if (
    typeof raw !== "string" ||
    raw.length > 254 ||
    raw !== raw.trim() ||
    /[\s<>(),;:\\"\[\]\x00-\x1f\x7f]/.test(raw)
  )
    return "";
  const parts = raw.split("@");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    parts[0].length > 64 ||
    parts[0].startsWith(".") ||
    parts[0].endsWith(".") ||
    parts[0].includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0])
  )
    return "";
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parts[1])
  )
    return "";
  return raw.toLowerCase();
}
export const REPLY_CATEGORIES = [
  "affiliate",
  "partner",
  "administration",
  "editorial",
  "support",
  "security",
] as const;
export type ReplyCategory = (typeof REPLY_CATEGORIES)[number];
export type DeliverySettings = {
  senderDisplayName: string;
  senderEmail: string;
  defaultReplyTo: string;
  categoryReplyTo: Partial<Record<ReplyCategory, string>>;
  verifiedReplyTo: string[];
};
export function senderIdentity(raw: string) {
  const match = raw.match(/^([^<>\r\n]{1,100})\s*<([^<>]+)>$/);
  const email = mailAddress(match ? match[2] : raw);
  if (!email) throw Error("Configured sender email is invalid.");
  return { email, name: match ? match[1].trim() : "JKTL Business" };
}
export function verifiedSenders() {
  const current = senderIdentity(
    process.env.RESEND_FROM_EMAIL ||
      "JKTL Business <jktl-business@mail.ibiz.name.ng>",
  );
  return [
    ...new Set([
      current.email,
      ...(process.env.EMAIL_VERIFIED_SENDER_ADDRESSES || "")
        .split(",")
        .map((s) => mailAddress(s.trim()))
        .filter(Boolean),
    ]),
  ];
}
export function deliveryHeaders(
  settings: DeliverySettings,
  options: { replyCategory?: ReplyCategory; replyTo?: string } = {},
) {
  const existing = senderIdentity(
    process.env.RESEND_FROM_EMAIL ||
      "JKTL Business <jktl-business@mail.ibiz.name.ng>",
  );
  const email = settings.senderEmail || existing.email;
  if (!verifiedSenders().includes(email))
    throw Error(
      "Sender address requires provider verification and secure allowlist configuration.",
    );
  const name = settings.senderDisplayName || existing.name;
  if (!name || name.length > 100 || /[<>\r\n\x00-\x1f\x7f]/.test(name))
    throw Error("Invalid sender display name.");
  const approved = settings.verifiedReplyTo.filter((v) => mailAddress(v) === v);
  const reply =
    options.replyTo ||
    (options.replyCategory
      ? settings.categoryReplyTo[options.replyCategory]
      : "") ||
    settings.defaultReplyTo;
  if (reply && (!mailAddress(reply) || !approved.includes(reply)))
    throw Error("Reply-To must be an administrator-verified mailbox.");
  return {
    from: `${JSON.stringify(name)} <${email}>`,
    ...(reply ? { replyTo: reply } : {}),
  };
}
