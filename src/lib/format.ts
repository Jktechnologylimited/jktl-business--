const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const nairaFormatterWithKobo = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

/** Format integer kobo as a Naira string, e.g. 18550000 -> "₦185,500". */
export function formatKobo(kobo: number, opts?: { showKobo?: boolean }): string {
  const naira = kobo / 100;
  return opts?.showKobo ? nairaFormatterWithKobo.format(naira) : nairaFormatter.format(naira);
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-NG", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatLongDate(iso: string | Date): string {
  return dateFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string | Date): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return timeFormatter.format(new Date(iso)).replace(" ", "");
}

export function formatRelativeDay(iso: string | Date, now = new Date()): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  return formatShortDate(date);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Format a byte count as MB to one decimal place, e.g. 5_242_880 -> "5.0 MB". */
export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
