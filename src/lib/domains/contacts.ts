import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { parseRegistrant, type Registrant } from "./model";
function key() {
  const raw = process.env.DOMAIN_CONTACT_ENCRYPTION_KEY || "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw Error("Secure domain-contact storage is not configured.");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32)
    throw Error("Secure domain-contact storage is not configured.");
  return value;
}
export function encryptContact(contact: Registrant) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("jktl-domain-registrant-v1"));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(contact), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decryptContact(raw: string): Registrant {
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 29) throw Error("Could not read registrant contact.");
  const cipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from("jktl-domain-registrant-v1"));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return parseRegistrant(
    JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString("utf8"),
    ),
  );
}
