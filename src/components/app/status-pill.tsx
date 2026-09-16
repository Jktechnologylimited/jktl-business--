import { cn } from "@/lib/utils";
import type { BookingStatus, InvoiceStatus, PaymentStatus } from "@/lib/types";

export type Tone = "primary" | "info" | "accent" | "danger" | "neutral";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-strong",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent-strong",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-strong text-ink-muted",
};

export function StatusPill({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", toneClasses[tone])}>
      {children}
    </span>
  );
}

const bookingLabels: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const bookingTones: Record<BookingStatus, Tone> = {
  pending: "accent",
  confirmed: "info",
  completed: "primary",
  cancelled: "danger",
  no_show: "danger",
};
export function bookingStatusMeta(status: BookingStatus) {
  return { label: bookingLabels[status], tone: bookingTones[status] };
}

const invoiceLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
};
const invoiceTones: Record<InvoiceStatus, Tone> = {
  draft: "neutral",
  pending: "accent",
  paid: "primary",
  overdue: "danger",
};
export function invoiceStatusMeta(status: InvoiceStatus) {
  return { label: invoiceLabels[status], tone: invoiceTones[status] };
}

const paymentLabels: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partial",
};
const paymentTones: Record<PaymentStatus, Tone> = {
  paid: "primary",
  pending: "accent",
  partial: "accent",
};
export function paymentStatusMeta(status: PaymentStatus) {
  return { label: paymentLabels[status], tone: paymentTones[status] };
}
