import "server-only";
import { getSql } from "./client";

/**
 * A business's settlement bank account and the Paystack Subaccount created
 * from it — everything the invoice payment link needs to route money
 * straight to the business. See src/lib/paystack.ts for the Paystack side
 * and src/app/pay/[id] for where this gets used.
 */
export interface PaymentSettings {
  organizationId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  /** Empty until a Subaccount has actually been created — the invoice
   * payment link stays disabled (manual bank-transfer details only) until
   * this is set. */
  subaccountCode: string;
}

function mapSettings(orgId: string, row: Record<string, unknown> | undefined): PaymentSettings {
  if (!row) {
    return { organizationId: orgId, bankCode: "", bankName: "", accountNumber: "", accountName: "", subaccountCode: "" };
  }
  return {
    organizationId: orgId,
    bankCode: row.settlement_bank_code as string,
    bankName: row.settlement_bank_name as string,
    accountNumber: row.settlement_account_number as string,
    accountName: row.settlement_account_name as string,
    subaccountCode: row.paystack_subaccount_code as string,
  };
}

export async function getPaymentSettings(orgId: string): Promise<PaymentSettings> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM payment_settings WHERE organization_id = ${orgId}`;
  return mapSettings(orgId, rows[0]);
}

export async function savePaymentSettings(
  orgId: string,
  patch: { bankCode: string; bankName: string; accountNumber: string; accountName: string; subaccountCode: string },
): Promise<PaymentSettings> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO payment_settings (organization_id, settlement_bank_code, settlement_bank_name, settlement_account_number, settlement_account_name, paystack_subaccount_code, updated_at)
    VALUES (${orgId}, ${patch.bankCode}, ${patch.bankName}, ${patch.accountNumber}, ${patch.accountName}, ${patch.subaccountCode}, now())
    ON CONFLICT (organization_id) DO UPDATE SET
      settlement_bank_code = excluded.settlement_bank_code,
      settlement_bank_name = excluded.settlement_bank_name,
      settlement_account_number = excluded.settlement_account_number,
      settlement_account_name = excluded.settlement_account_name,
      paystack_subaccount_code = excluded.paystack_subaccount_code,
      updated_at = now()
    RETURNING *
  `;
  return mapSettings(orgId, rows[0]);
}
