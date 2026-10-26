export const SCOPES = ["website_draft", "website_publish"] as const;
export function id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw Error("Invalid reference.");
  return value;
}
export function text(value: unknown, max = 3000, min = 1) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    throw Error("Check the text length.");
  return value.trim();
}
export function redact(value: string) {
  return value
    .replace(
      /\b(?:sk_(?:live|test)_[a-z0-9]+|Bearer\s+[\w.-]+)\b/gi,
      "[secret removed]",
    )
    .replace(/\bsk-[A-Za-z0-9]{20,}\b/g, "[secret removed]")
    .replace(/\b(password|otp|cvv|pin)\s*[:=]\s*\S+/gi, "$1: [removed]")
    .replace(/\b(?:\d[ -]?){16}\b/g, "[number removed]");
}
export function sensitive(value: string) {
  return /\b(refund|chargeback|compromised|hacked|password|otp|credential|ownership|registrant|transfer code|delete account|bank details|change.*email|payout|unauthori[sz]ed charge)\b/i.test(
    value,
  );
}
export function pushSubscription(value: unknown) {
  const s = value as Record<string, unknown>;
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 2000)
    throw Error("Invalid notification device.");
  const url = new URL(s.endpoint);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (![
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "web.push.apple.com",
    ].includes(host) &&
      !host.endsWith(".push.apple.com") &&
      !host.endsWith(".notify.windows.com"))
  )
    throw Error("Unsupported push provider.");
  if (
    typeof s.p256dh !== "string" ||
    !/^[A-Za-z0-9_-]{80,100}={0,2}$/.test(s.p256dh) ||
    typeof s.auth !== "string" ||
    !/^[A-Za-z0-9_-]{20,30}={0,2}$/.test(s.auth)
  )
    throw Error("Invalid notification keys.");
  return { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth };
}
export function safeAssistantReply(value: string) {
  const requests = value.replace(
    /\b(?:never|do not|don't)\s+(?:send|share|provide|give)[^.!?\n]*(?:[.!?]|$)/gi,
    "",
  );
  if (
    /(?:send|share|provide|tell me|give me).{0,50}(?:your password|your otp|your cvv|card number|bank password)|(?:i have|i've|we have|successfully).{0,30}(?:refunded|charged|registered|verified your|provisioned|changed your)/i.test(
      requests,
    )
  )
    return false;
  const urls = value.match(/https?:\/\/[^\s)\]]+/gi) || [];
  return urls.every((link) => {
    try {
      return [
        "jktl.com.ng",
        "www.jktl.com.ng",
        "business.jktl.com.ng",
      ].includes(new URL(link).hostname);
    } catch {
      return false;
    }
  });
}
export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /^(Only |Claim |Active business |Support case |Please |Choose |Invalid |Check |This case |This account |This device |This deployment |The case |The website |Save blocked|Permission |Sign in |Open a new|Review |Your feedback |Publication |Push notifications|Template unavailable|Unsupported push|Invalid notification|Could not )/.test(
    message,
  )
    ? message
    : "Could not complete this request. Refresh your sign-in and try again, or contact a team member.";
}
export function wantsHuman(value: string) {
  return /\b(?:talk|speak|chat|connect|transfer|need|want).{0,30}\b(?:a human|human support|human help|a person|an agent|a real person|a support agent)\b|^human[!. ]*$/i.test(
    value,
  );
}
