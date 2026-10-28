"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/domains/service";
import {
  fetchGo54WholesalePricing,
  GO54_WRITES_IMPLEMENTED,
} from "@/lib/domains/go54";
import {
  saveMarkupPolicy,
  saveOperatorWallet,
  saveVerifiedWholesale,
} from "@/lib/domains/registrar-admin";
import { rateLimit } from "@/lib/domains/store";

function failure() {
  return {
    ok: false as const,
    error:
      "Could not update registrar operations. Check permissions, current revisions and the recorded values.",
  };
}
export async function registrarDashboardAction() {
  try {
    await requireAdminCapability("manage_domains");
    const [state, prices, operations, alerts] = await Promise.all([
      query("SELECT * FROM domain_registrar_state WHERE id=true", []),
      query(
        "SELECT extension,registration_cost,renewal_cost,transfer_cost,pricing_mode,markup_bps,markup_fixed_kobo,wholesale_synced_at,revision FROM domain_prices ORDER BY extension",
        [],
      ),
      query(
        "SELECT id,order_id,kind,domain,attempt,state,transaction_reference,submitted_at,reconciled_at,reason FROM domain_registrar_operations ORDER BY created_at DESC LIMIT 50",
        [],
      ),
      query(
        "SELECT id,subject,detail,created_at,delivered_at FROM domain_registrar_alerts ORDER BY created_at DESC LIMIT 10",
        [],
      ),
    ]);
    return {
      ok: true as const,
      data: {
        state: state[0] || null,
        prices,
        operations,
        alerts,
        writeAdapterImplemented: GO54_WRITES_IMPLEMENTED,
      },
    };
  } catch {
    return failure();
  }
}
export async function recordWholesaleAction(raw: {
  extension: string;
  registration: number;
  renewal: number;
  transfer: number;
  revision: number;
  verified: boolean;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    if (raw?.verified !== true) throw Error();
    await saveVerifiedWholesale(query, actor.id, raw);
    return { ok: true as const };
  } catch {
    return failure();
  }
}
export async function configureMarkupAction(raw: {
  extension: string;
  revision: number;
  mode: "MANUAL" | "MARKUP";
  bps: number;
  fixed: number;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    await saveMarkupPolicy(query, actor.id, raw);
    return { ok: true as const };
  } catch {
    return failure();
  }
}
export async function recordRegistrarWalletAction(raw: {
  balance: number;
  threshold: number;
  revision: number;
  verified: boolean;
}) {
  try {
    const actor = await requireAdminCapability("manage_domains");
    if (raw?.verified !== true) throw Error();
    await saveOperatorWallet(query, actor.id, raw);
    return { ok: true as const };
  } catch {
    return failure();
  }
}
export async function checkGo54PricingTransportAction() {
  try {
    const actor = await requireAdminCapability("manage_domains");
    await rateLimit(query, actor.id, "go54-pricing", 3, 300);
    await fetchGo54WholesalePricing();
    // Do not return raw provider JSON, auth headers or an invented success flag.
    return {
      ok: true as const,
      message:
        "Pricing JSON received. Response mapping and provider success semantics still need verification; selling prices and purchase safeguards were not changed.",
    };
  } catch {
    return {
      ok: false as const,
      error:
        "The read-only GO54 pricing request could not be completed. Check secure credentials and provider access.",
    };
  }
}
