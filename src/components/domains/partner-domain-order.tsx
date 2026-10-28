"use client";
import { useState } from "react";
import { partnerCreateDomainOrderAction } from "@/lib/actions/partner-domain-orders";
import { DOMAIN_TERMS, money } from "@/lib/domains/model";
export function PartnerDomainOrder({
  workspaceId,
  prices,
  assets,
}: {
  workspaceId: string;
  prices: Record<string, unknown>[];
  assets: Record<string, unknown>[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <details className="rounded-lg border border-border p-4">
      <summary>Create an authorized client domain order</summary>
      <p>
        The business owner must grant PURCHASE_DOMAINS permission. Use the
        customer's authorized registrant details; the partner does not become
        the domain owner. Payment is billed to the client organization.
      </p>
      <form
        className="my-4 grid gap-3 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          const asset = assets.find((a) => String(a.id) === f.get("renew"));
          try {
            const r = await partnerCreateDomainOrderAction(workspaceId, {
              domain: asset ? String(asset.domain) : String(f.get("domain")),
              extension: asset
                ? String(asset.extension)
                : String(f.get("extension")),
              kind: asset ? "RENEW" : "REGISTER",
              assetId: asset ? String(asset.id) : undefined,
              years: Number(f.get("years")),
              consent: f.get("consent") === "on",
              termsVersion: DOMAIN_TERMS,
              registrant: Object.fromEntries(
                [
                  "name",
                  "email",
                  "phone",
                  "company",
                  "address",
                  "city",
                  "state",
                  "postalCode",
                  "country",
                ].map((k) => [k, String(f.get(k) || "")]),
              ),
            });
            window.location.assign(r.url);
          } catch {
            setError(
              "Could not prepare checkout. Check the owner’s purchasing permission, availability, current prices and existing orders before trying again.",
            );
            setBusy(false);
          }
        }}
      >
        <label>
          Register a domain <input name="domain" maxLength={253} />
        </label>
        <label>
          Extension{" "}
          <select name="extension">
            {prices.map((p) => (
              <option key={String(p.extension)} value={String(p.extension)}>
                {String(p.extension)} · First year {money(p.registration_price)}{" "}
                · Renewal {money(p.renewal_price)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Or renew a client domain{" "}
          <select name="renew">
            <option value="">New registration</option>
            {assets.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.domain)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Years{" "}
          <input
            name="years"
            type="number"
            min={1}
            max={10}
            defaultValue={1}
            required
          />
        </label>
        {[
          "name",
          "email",
          "phone",
          "company",
          "address",
          "city",
          "state",
          "postalCode",
          "country",
        ].map((k) => (
          <label key={k}>
            Registrant {k}
            <input
              name={k}
              required={k !== "company"}
              maxLength={k === "country" ? 2 : 250}
              type={k === "email" ? "email" : "text"}
              defaultValue={k === "country" ? "NG" : undefined}
            />
          </label>
        ))}
        <label className="md:col-span-2">
          <input name="consent" type="checkbox" required /> The client
          authorized these registrant details, this purchase and the domain
          registration terms. No domain substitution is authorized.
        </label>
        <p role="alert">{error}</p>
        <button disabled={busy}>Review payment securely</button>
      </form>
    </details>
  );
}
