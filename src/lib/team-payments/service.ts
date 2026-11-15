import "server-only";
import {
  bankInput,
  decryptDetails,
  encryptDetails,
  encryptionKey,
  revision,
  uuid,
  type PaymentDetails,
  type PaymentReviewRow,
  type PaymentStatus,
} from "./model";
type Row = Record<string, unknown>;
type Query = (text: string, values?: unknown[]) => Promise<Row[]>;
type Actor = { id: string };
type Provider = {
  banks: () => Promise<{ code: string; name: string }[]>;
  resolve: (
    number: string,
    bank: string,
  ) => Promise<{ accountNumber: string; accountName: string }>;
};
async function active(q: Query, actor: Actor, owner = false) {
  const row = (
    await q(
      "SELECT id,role FROM admin_users WHERE id=$1 AND disabled_at IS NULL AND staff_revoked_at IS NULL",
      [uuid(actor.id)],
    )
  )[0];
  if (!row || (owner && row.role !== "owner")) throw Error("Access denied.");
  return row;
}
function view(row: Row): PaymentDetails {
  let accountName = "";
  if (row.encrypted_details) {
    try {
      accountName = decryptDetails(
        String(row.admin_id),
        String(row.encrypted_details),
      ).accountName;
    } catch {
      throw Error(
        "Saved payment details cannot be opened. Contact your Owner.",
      );
    }
  }
  return {
    adminId: String(row.admin_id),
    bankName: String(row.bank_name || ""),
    accountName,
    last4: String(row.account_last4 || ""),
    status: row.status as PaymentStatus,
    revision: Number(row.revision),
    verifiedAt: row.verified_at
      ? new Date(String(row.verified_at)).toISOString()
      : null,
    reviewedAt: row.reviewed_at
      ? new Date(String(row.reviewed_at)).toISOString()
      : null,
    reviewNote: String(row.review_note || ""),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
export async function ownDetails(q: Query, actor: Actor) {
  await active(q, actor);
  const row = (
    await q("SELECT d.* FROM team_payment_details d JOIN admin_users a ON a.id=d.admin_id WHERE d.admin_id=$1 AND a.disabled_at IS NULL AND a.staff_revoked_at IS NULL", [actor.id])
  )[0];
  return row ? view(row) : null;
}
export async function verifyBank(
  q: Query,
  actor: Actor,
  input: { bankCode: unknown; accountNumber: unknown },
  provider: Provider,
) {
  await active(q, actor);
  encryptionKey();
  const details = bankInput(input);
  let bank: { code: string; name: string } | undefined;
  let resolved: { accountNumber: string; accountName: string };
  try {
    bank = (await provider.banks()).find((b) => b.code === details.bankCode);
    if (
      !bank ||
      typeof bank.name !== "string" ||
      !bank.name.trim() ||
      bank.name.length > 150
    )
      throw Error("Invalid bank");
    resolved = await provider.resolve(details.accountNumber, details.bankCode);
  } catch {
    throw Error(
      "We could not verify this bank account. Check the details and try again.",
    );
  }
  if (
    !resolved ||
    resolved.accountNumber !== details.accountNumber ||
    typeof resolved.accountName !== "string" ||
    !resolved.accountName.trim() ||
    resolved.accountName.length > 200
  )
    throw Error(
      "The bank returned an invalid account confirmation. Please try again.",
    );
  return {
    bankCode: bank.code,
    bankName: bank.name,
    accountName: resolved.accountName.trim(),
    last4: details.accountNumber.slice(-4),
  };
}
export async function submitDetails(
  q: Query,
  actor: Actor,
  input: {
    bankCode: unknown;
    accountNumber: unknown;
    revision: unknown;
    confirmed: unknown;
  },
  provider: Provider,
) {
  const expected = revision(input.revision);
  if (input.confirmed !== true)
    throw Error("Confirm that this account can receive your team payments.");
  const verified = await verifyBank(q, actor, input, provider); // Always re-resolve; never trust a browser preview/name.
  const encrypted = encryptDetails(actor.id, {
    accountNumber: String(input.accountNumber),
    accountName: verified.accountName,
  });
  const rows = await q(
    `WITH eligible AS(SELECT id FROM admin_users WHERE id=$1 AND disabled_at IS NULL AND staff_revoked_at IS NULL FOR UPDATE),
 changed AS(INSERT INTO team_payment_details(admin_id,bank_code,bank_name,account_last4,encrypted_details,status,verified_at)
 SELECT id,$2,$3,$4,$5,'PENDING',now() FROM eligible WHERE $6::int=0
 UNION ALL SELECT e.id,$2,$3,$4,$5,'PENDING',now() FROM eligible e WHERE $6::int>0 AND EXISTS(SELECT 1 FROM team_payment_details d WHERE d.admin_id=e.id AND d.revision=$6)
 ON CONFLICT(admin_id) DO UPDATE SET bank_code=excluded.bank_code,bank_name=excluded.bank_name,account_last4=excluded.account_last4,encrypted_details=excluded.encrypted_details,status='PENDING',verified_at=now(),reviewed_by=NULL,reviewed_at=NULL,review_note='',revision=team_payment_details.revision+1,updated_at=now()
 WHERE team_payment_details.revision=$6 RETURNING *),
 logged AS(INSERT INTO team_payment_details_audit(admin_id,actor_id,event,revision) SELECT admin_id,$1,'SUBMITTED',revision FROM changed RETURNING id)
 SELECT changed.* FROM changed WHERE (SELECT count(*) FROM logged)=1`,
    [
      actor.id,
      verified.bankCode,
      verified.bankName,
      verified.last4,
      encrypted,
      expected,
    ],
  );
  if (!rows[0])
    throw Error(
      "Payment details changed or access expired. Reload before saving.",
    );
  return view(rows[0]);
}
export async function reviewDetails(
  q: Query,
  actor: Actor,
  input: {
    adminId: unknown;
    revision: unknown;
    decision: unknown;
    note: unknown;
  },
) {
  await active(q, actor, true);
  const target = uuid(input.adminId),
    expected = revision(input.revision);
  if (
    !["APPROVED", "REJECTED"].includes(String(input.decision)) ||
    typeof input.note !== "string" ||
    input.note.length > 500 ||
    (input.decision === "REJECTED" && input.note.trim().length < 5)
  )
    throw Error(
      "Choose a decision and give a short explanation for a rejection.",
    );
  const rows = await q(
    `WITH changed AS(UPDATE team_payment_details d SET status=$4,reviewed_by=$1,reviewed_at=now(),review_note=$5,revision=revision+1,updated_at=now()
 WHERE admin_id=$2 AND revision=$3 AND status='PENDING' AND verified_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM admin_users WHERE id=$1 AND role='owner' AND disabled_at IS NULL AND staff_revoked_at IS NULL)
 AND EXISTS(SELECT 1 FROM admin_users WHERE id=$2 AND disabled_at IS NULL AND staff_revoked_at IS NULL) RETURNING d.*),
 logged AS(INSERT INTO team_payment_details_audit(admin_id,actor_id,event,revision) SELECT admin_id,$1,$4,revision FROM changed RETURNING id)
 SELECT changed.* FROM changed WHERE (SELECT count(*) FROM logged)=1`,
    [actor.id, target, expected, input.decision, input.note.trim()],
  );
  if (!rows[0])
    throw Error(
      "These details changed or cannot be reviewed. Refresh and review the latest version.",
    );
  return view(rows[0]);
}
export async function removeDetails(q: Query, actor: Actor, expected: unknown) {
  await active(q, actor);
  const rows = await q(
    `WITH changed AS(UPDATE team_payment_details SET bank_code=NULL,bank_name=NULL,account_last4=NULL,encrypted_details=NULL,status='REMOVED',verified_at=NULL,reviewed_by=NULL,reviewed_at=NULL,review_note='',revision=revision+1,updated_at=now()
 WHERE admin_id=$1 AND revision=$2 AND status<>'REMOVED' AND EXISTS(SELECT 1 FROM admin_users WHERE id=$1 AND disabled_at IS NULL AND staff_revoked_at IS NULL) RETURNING *),
 logged AS(INSERT INTO team_payment_details_audit(admin_id,actor_id,event,revision) SELECT admin_id,$1,'REMOVED',revision FROM changed RETURNING id)
 SELECT changed.* FROM changed WHERE (SELECT count(*) FROM logged)=1`,
    [actor.id, revision(expected)],
  );
  if (!rows[0])
    throw Error("Payment details changed. Refresh before removing them.");
  return view(rows[0]);
}
export async function reviewQueue(
  q: Query,
  actor: Actor,
  page: unknown = 0,
  status: unknown = "ALL",
) {
  await active(q, actor, true);
  if (
    !Number.isInteger(page) ||
    Number(page) < 0 ||
    Number(page) > 1000 ||
    !["ALL", "PENDING", "APPROVED", "REJECTED", "REMOVED"].includes(
      String(status),
    )
  )
    throw Error("Invalid review filter.");
  const rows = await q(
    `SELECT d.*,a.name,a.role FROM team_payment_details d JOIN admin_users a ON a.id=d.admin_id WHERE a.disabled_at IS NULL AND a.staff_revoked_at IS NULL AND($1='ALL' OR d.status=$1) AND EXISTS(SELECT 1 FROM admin_users viewer WHERE viewer.id=$3 AND viewer.role='owner' AND viewer.disabled_at IS NULL AND viewer.staff_revoked_at IS NULL) ORDER BY d.updated_at DESC,d.admin_id LIMIT 26 OFFSET $2`,
    [status, Number(page) * 25, actor.id],
  );
  return {
    rows: rows
      .slice(0, 25)
      .map((row): PaymentReviewRow => ({
        ...view(row),
        name: String(row.name),
        role: String(row.role),
      })),
    more: rows.length > 25,
    page: Number(page),
  };
}
export async function revealDetails(
  q: Query,
  actor: Actor,
  input: { adminId: unknown; revision: unknown; reason: unknown },
) {
  await active(q, actor);
  const target = uuid(input.adminId);
  if (
    typeof input.reason !== "string" ||
    !["SELF_REVIEW", "PAYMENT_PREPARATION"].includes(input.reason)
  )
    throw Error("Choose a valid reason to view payment details.");
  const rows = await q(
    `WITH allowed AS(SELECT d.* FROM team_payment_details d JOIN admin_users t ON t.id=d.admin_id JOIN admin_users a ON a.id=$1
 WHERE d.admin_id=$2 AND d.revision=$3 AND d.status<>'REMOVED' AND t.disabled_at IS NULL AND t.staff_revoked_at IS NULL AND a.disabled_at IS NULL AND a.staff_revoked_at IS NULL
 AND(a.id=d.admin_id AND $4='SELF_REVIEW' OR a.role='owner' AND d.status='APPROVED' AND $4='PAYMENT_PREPARATION')),
 logged AS(INSERT INTO team_payment_details_audit(admin_id,actor_id,event,revision,reason) SELECT admin_id,$1,'REVEALED',revision,$4 FROM allowed RETURNING id)
 SELECT allowed.* FROM allowed WHERE (SELECT count(*) FROM logged)=1`,
    [actor.id, target, revision(input.revision), input.reason],
  );
  if (!rows[0])
    throw Error(
      "You cannot view these payment details, or this version is no longer approved.",
    );
  const details = decryptDetails(target, String(rows[0].encrypted_details));
  return { ...details, bankName: String(rows[0].bank_name) };
}
