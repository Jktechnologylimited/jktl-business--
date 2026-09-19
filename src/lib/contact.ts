/** Small helpers for the public business site — normalizing contact details
 * into links a visitor can actually tap. */

/**
 * Normalizes a Nigerian phone number (however it was typed — with a leading
 * 0, a +234, spaces, dashes) into a wa.me link. Returns null when there's
 * nothing usable to link to. An optional `message` is pre-filled into the
 * chat (used by the product catalog's "Order via WhatsApp" buttons) — the
 * visitor still has to hit send themselves, nothing here sends anything.
 */
export function waLink(phone: string, message?: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  let national: string;
  if (digits.startsWith("234")) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  if (national.length !== 10) return null; // not a recognizable NG mobile number
  const base = `https://wa.me/234${national}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(phone: string): string | null {
  const digits = phone.replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function mailLink(email: string): string | null {
  return email.trim() ? `mailto:${email.trim()}` : null;
}

/** Relative luminance (WCAG) to decide whether black or white text reads
 * better on top of an arbitrary brand color. */
export function textOnColor(hex: string): "#0b0d11" | "#ffffff" {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5 ? "#0b0d11" : "#ffffff";
}
