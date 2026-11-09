"use client";
import { useState } from "react";
import { ActionForm } from "@/components/distribution/action-form";
import { saveBuyerFeePolicyAction } from "@/lib/actions/merchant-fee-actions";
import { PROPOSED_BANDS, minorInput } from "@/lib/merchant-fees/model";
type Initial = {
  label: string;
  enabled: boolean;
  bands: { minKobo: number; feeKobo: number }[];
  sources: string[];
  exemptions: string[];
};
export function BuyerFeeEditor({
  initial,
  businesses,
}: {
  initial?: Initial;
  businesses: { id: string; name: string }[];
}) {
  const [bands, setBands] = useState(
    (initial?.bands || PROPOSED_BANDS).map((b) => ({
      min: (b.minKobo / 100).toFixed(2),
      fee: (b.feeKobo / 100).toFixed(2),
    })),
  );
  const converted = bands.map((b) => {
    try {
      return {
        minKobo: minorInput(b.min, true),
        feeKobo: minorInput(b.fee, true),
      };
    } catch {
      return { minKobo: -1, feeKobo: -1 };
    }
  });
  const valid = converted.every((b) => b.minKobo >= 0 && b.feeKobo >= 0);
  const input =
    "mt-2 block w-full rounded-lg border border-border bg-paper p-3";
  return (
    <ActionForm
      action={saveBuyerFeePolicyAction}
      success="New draft version saved. Existing prices and live policy are unchanged."
    >
      <h3 className="font-semibold">Create a reviewed policy draft</h3>
      <label>
        Policy name
        <input
          name="label"
          className={input}
          minLength={3}
          maxLength={100}
          defaultValue={initial?.label || "Proposed buyer-paid NGN fees"}
          required
        />
      </label>
      <label className="my-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial?.enabled ?? true}
        />
        Enable fees if this version is separately approved and activated
      </label>
      <p className="my-3 text-xs text-ink-muted">
        Each threshold is inclusive and runs up to the next threshold. Start at
        zero. Fees apply once per successful payment, on merchant principal
        before the platform fee. No buyer processor surcharge is configured.
      </p>
      <div className="space-y-3">
        {bands.map((b, i) => (
          <fieldset
            key={i}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <legend className="px-1 text-xs">Band {i + 1}</legend>
            <label>
              From amount (NGN)
              <input
                aria-label={`Band ${i + 1} from amount`}
                inputMode="decimal"
                value={b.min}
                onChange={(e) =>
                  setBands(
                    bands.map((x, n) =>
                      n === i ? { ...x, min: e.target.value } : x,
                    ),
                  )
                }
                className={input}
                required
              />
            </label>
            <label>
              Flat JKTL fee (NGN)
              <input
                aria-label={`Band ${i + 1} fee`}
                inputMode="decimal"
                value={b.fee}
                onChange={(e) =>
                  setBands(
                    bands.map((x, n) =>
                      n === i ? { ...x, fee: e.target.value } : x,
                    ),
                  )
                }
                className={input}
                required
              />
            </label>
            <button
              type="button"
              disabled={bands.length === 1}
              onClick={() => setBands(bands.filter((_, n) => n !== i))}
              className="text-sm text-danger underline"
            >
              Remove band
            </button>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        disabled={bands.length >= 12}
        onClick={() => setBands([...bands, { min: "", fee: "" }])}
        className="my-3 text-sm text-primary underline"
      >
        Add band
      </button>
      <input type="hidden" name="bands" value={JSON.stringify(converted)} />
      <fieldset className="my-4">
        <legend className="text-sm font-semibold">
          Eligible merchant sources
        </legend>
        {["INVOICE", "WEBSITE"].map((source) => (
          <label className="mt-2 flex gap-2 text-sm" key={source}>
            <input
              type="checkbox"
              name="sources"
              value={source}
              defaultChecked={initial?.sources.includes(source) ?? true}
            />
            {source === "INVOICE"
              ? "Invoice payment links"
              : "Native website checkout adapter (not currently live)"}
          </label>
        ))}
      </fieldset>
      <label>
        Exempt businesses (optional)
        <select
          multiple
          name="exemptions"
          defaultValue={initial?.exemptions || []}
          className={input}
          size={Math.min(5, Math.max(2, businesses.length))}
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <p className="my-2 text-xs text-ink-muted">
        Use Ctrl/Command to select multiple businesses. JKTL subscriptions,
        domains, infrastructure and Custom billing are outside this merchant
        policy.
      </p>
      <button
        disabled={!valid}
        className="mt-3 rounded-lg bg-primary p-3 text-on-primary disabled:opacity-50"
      >
        Save inactive draft version
      </button>
    </ActionForm>
  );
}
