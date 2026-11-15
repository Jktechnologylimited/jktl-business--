import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
export type PaymentDetails = {
  adminId: string;
  bankName: string;
  accountName: string;
  last4: string;
  status: PaymentStatus;
  revision: number;
  verifiedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  updatedAt: string;
};
export type PaymentReviewRow = PaymentDetails & { name: string; role: string };
export function encryptionKey() {
  const raw = process.env.TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw Error(
      "Team payment details are not configured yet. Contact your Owner.",
    );
  return key;
}
export function paymentsConfigured() {
  try {
    encryptionKey();
    return Boolean(process.env.PAYSTACK_SECRET_KEY);
  } catch {
    return false;
  }
}
export function encryptDetails(
  adminId: string,
  details: { accountNumber: string; accountName: string },
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("jktl:team-payment-details:" + adminId));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(details), "utf8"),
    cipher.final(),
  ]);
  return (
    "v1." + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")
  );
}
export function decryptDetails(
  adminId: string,
  encrypted: string,
): { accountNumber: string; accountName: string } {
  if (!encrypted.startsWith("v1."))
    throw Error("Unsupported payment details format.");
  const bytes = Buffer.from(encrypted.slice(3), "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from("jktl:team-payment-details:" + adminId));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const value = JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
  if (
    !/^\d{10}$/.test(value.accountNumber) ||
    typeof value.accountName !== "string" ||
    !value.accountName.trim()
  )
    throw Error("Invalid payment details.");
  return value;
}
export function revision(value: unknown) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 2147483646
  )
    throw Error("Reload the latest payment details.");
  return Number(value);
}
export function bankInput(input: {
  bankCode: unknown;
  accountNumber: unknown;
}) {
  if (
    typeof input?.bankCode !== "string" ||
    !/^[A-Za-z0-9-]{2,12}$/.test(input.bankCode) ||
    typeof input.accountNumber !== "string" ||
    !/^\d{10}$/.test(input.accountNumber)
  )
    throw Error("Choose a bank and enter a 10-digit Nigerian account number.");
  return { bankCode: input.bankCode, accountNumber: input.accountNumber };
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  )
    throw Error("Invalid team account.");
  return value;
}
