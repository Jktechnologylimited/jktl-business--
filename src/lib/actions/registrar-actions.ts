"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/domains/service";
import {
  GO54_REQUEST_CONTRACTS_IMPLEMENTED,
  GO54_WRITES_IMPLEMENTED,
} from "@/lib/domains/go54";
import {
  saveMarkupPolicy,
  saveOperatorWallet,
  saveVerifiedWholesale,
} from "@/lib/domains/registrar-admin";
import { rateLimit } from "@/lib/domains/store";
import {
  createGo54Client,
  Go54RequestError,
  configuredGo54ReadMethods,
} from "@/lib/domains/go54-client";
import { recordGo54Diagnostic } from "@/lib/domains/go54-diagnostics";

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
    const [state, prices, operations, alerts, diagnostics] = await Promise.all([
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
      query(
        "SELECT id,operation,method,http_status,json_valid,sanitized_payload,observed_at,captured_at FROM domain_registrar_diagnostics ORDER BY captured_at DESC LIMIT 3",
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
        requestContractsImplemented: GO54_REQUEST_CONTRACTS_IMPLEMENTED,
        diagnostics,
        retrievalMethods: configuredGo54ReadMethods(),
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
  let actorId: string | null = null;
  try {
    const actor = await requireAdminCapability("manage_domains");
    actorId = actor.id;
    await rateLimit(query, actor.id, "go54-pricing", 3, 300);
    // Explicit operator-triggered, read-only, uncached diagnostic. It never
    // runs during render/cron or makes a registrar purchase.
    const reply = await createGo54Client().getPricing();
    await recordGo54Diagnostic(query, actor.id, reply.diagnostic);
    // Do not return raw provider JSON, auth headers or an invented success flag.
    return {
      ok: true as const,
      message: `Registrar HTTP ${reply.httpStatus} JSON captured with redaction. Provider success semantics remain unverified; selling prices and purchase safeguards were not changed.`,
    };
  } catch (error) {
    if (actorId && error instanceof Go54RequestError && error.diagnostic) {
      try {
        await recordGo54Diagnostic(query, actorId, error.diagnostic);
      } catch {
        /* no raw body/log fallback */
      }
    }
    return {
      ok: false as const,
      error:
        "The read-only GO54 pricing request could not be completed. Check secure credentials and provider access.",
    };
  }
}
