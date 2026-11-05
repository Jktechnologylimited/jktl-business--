import { createHmac, timingSafeEqual } from "node:crypto";
export {
  PORTAL_SCOPES,
  portalScopes,
  invoiceStatus,
  nextInvoicePayment,
} from "./portal-labels";
import { amount, date, text } from "./model";
export type LineItem = {
  description: string;
  quantity: number;
  unitKobo: number;
};
export function invoiceInput(input: {
  items: unknown;
  instalments?: unknown;
  dueOn: unknown;
}) {
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 40
  )
    throw Error("Enter 1–40 invoice items.");
  const items: LineItem[] = input.items.map((item) => ({
    description: text(item?.description, 300),
    quantity: amount(item?.quantity),
    unitKobo: amount(item?.unitKobo),
  }));
  const total = amount(
    items.reduce((sum, item) => sum + item.quantity * item.unitKobo, 0),
  );
  const dueOn = date(input.dueOn);
  const instalments = input.instalments ?? [];
  if (!Array.isArray(instalments) || instalments.length > 24)
    throw Error("Enter up to 24 instalments.");
  const schedule = instalments.map((row) => ({
    dueOn: date(row?.dueOn),
    amountKobo: amount(row?.amountKobo),
  }));
  if (
    schedule.length &&
    (schedule.reduce((sum, row) => sum + row.amountKobo, 0) !== total ||
      schedule.some(
        (row, i) =>
          row.dueOn > dueOn || (i > 0 && row.dueOn < schedule[i - 1].dueOn),
      ))
  )
    throw Error(
      "Instalments must total the invoice amount, follow date order and end by the invoice due date.",
    );
  return { items, total, dueOn, instalments: schedule };
}
export function requestSignature(
  key: string,
  method: string,
  path: string,
  subject: string,
  timestamp: string,
  nonce: string,
  bodyHash: string,
) {
  return createHmac("sha256", key)
    .update([method, path, subject, timestamp, nonce, bodyHash].join("\n"))
    .digest("hex");
}
export function validSignature(actual: string, expected: string) {
  return (
    /^[a-f0-9]{64}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))
  );
}
