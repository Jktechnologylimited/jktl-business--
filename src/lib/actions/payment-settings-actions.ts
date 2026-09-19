"use server";

import { requireSession } from "@/lib/session";
import { getBusinessProfile } from "@/lib/db/organizations";
import { getPaymentSettings, savePaymentSettings } from "@/lib/db/payments";
import { listBanks, resolveAccountNumber, createSubaccount, updateSubaccountBank, type PaystackBank } from "@/lib/paystack";
import type { ActionResult } from "./types";
import type { PaymentSettings } from "@/lib/db/payments";

export async function listBanksAction(): Promise<ActionResult<PaystackBank[]>> {
  try {
    await requireSession();
    return { ok: true, data: await listBanks() };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load the bank list right now." };
  }
}

export async function getPaymentSettingsAction(): Promise<ActionResult<PaymentSettings>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await getPaymentSettings(organizationId) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load your payment settings." };
  }
}

/** Looks up the real account name for a bank + account number, so the
 * Settings form can show it back for confirmation before saving — never
 * lets a business save an account they haven't seen the resolved name
 * for. */
export async function verifyAccountAction(bankCode: string, accountNumber: string): Promise<ActionResult<{ accountName: string }>> {
  try {
    await requireSession();
    if (!bankCode || accountNumber.trim().length < 10) {
      return { ok: false, error: "Choose a bank and enter a 10-digit account number." };
    }
    const resolved = await resolveAccountNumber(accountNumber.trim(), bankCode);
    return { ok: true, data: { accountName: resolved.accountName } };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't verify that account — double-check the bank and account number." };
  }
}

/**
 * Saves a business's settlement bank details and creates (or updates) the
 * Paystack Subaccount their invoice payment links route into. Always
 * re-resolves the account number server-side right before saving — never
 * trusts a client-supplied account name, even one shown back from an
 * earlier `verifyAccountAction` call, since the account number could have
 * changed in between.
 */
export async function savePaymentSettingsAction(input: { bankCode: string; bankName: string; accountNumber: string }): Promise<ActionResult<PaymentSettings>> {
  try {
    const { organizationId } = await requireSession();
    const profile = await getBusinessProfile(organizationId);
    if (!profile) return { ok: false, error: "Business profile not found." };

    const accountNumber = input.accountNumber.trim();
    if (!input.bankCode || accountNumber.length < 10) {
      return { ok: false, error: "Choose a bank and enter a 10-digit account number." };
    }

    const resolved = await resolveAccountNumber(accountNumber, input.bankCode);
    const existing = await getPaymentSettings(organizationId);

    let subaccountCode = existing.subaccountCode;
    if (subaccountCode) {
      await updateSubaccountBank(subaccountCode, { bankCode: input.bankCode, accountNumber });
    } else {
      const created = await createSubaccount({ businessName: profile.displayName, bankCode: input.bankCode, accountNumber });
      subaccountCode = created.subaccountCode;
    }

    const saved = await savePaymentSettings(organizationId, {
      bankCode: input.bankCode,
      bankName: input.bankName,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
      subaccountCode,
    });
    return { ok: true, data: saved };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save your payment details — double-check the account number and try again." };
  }
}
