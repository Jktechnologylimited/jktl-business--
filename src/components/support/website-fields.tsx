"use client";
import type { WebsiteDocument } from "@/lib/website-templates";
export function WebsiteFields({
  value,
  onChange,
}: {
  value: WebsiteDocument;
  onChange: (d: WebsiteDocument) => void;
}) {
  const fields: [keyof WebsiteDocument, string][] = [
    ["brandName", "Business name"],
    ["eyebrow", "Introductory label"],
    ["headline", "Home headline"],
    ["intro", "Home introduction"],
    ["ctaLabel", "Button label"],
    ["logoUrl", "Logo image URL"],
    ["heroImage", "Hero image URL"],
    ["aboutTitle", "About heading"],
    ["aboutText", "About description"],
    ["offeringsTitle", "Services heading"],
    ["contactTitle", "Contact heading"],
    ["contactText", "Contact description"],
    ["seoTitle", "Search title"],
    ["seoDescription", "Search description"],
  ];
  return (
    <div className="space-y-5">
      {fields.map(([key, label]) => (
        <label className="block text-sm" key={key}>
          {label}
          <textarea
            aria-label={label}
            value={String(value[key] || "")}
            maxLength={3000}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            className="mt-2 min-h-16 w-full rounded-xl border border-border-strong bg-paper p-3"
          />
        </label>
      ))}
      <label className="block text-sm">
        Service areas, one per line
        <textarea
          aria-label="Service areas, one per line"
          value={(value.serviceAreas || []).join("\n")}
          onChange={(e) =>
            onChange({
              ...value,
              serviceAreas: e.target.value.split("\n").filter(Boolean),
            })
          }
          className="mt-2 w-full rounded-xl border border-border-strong bg-paper p-3"
        />
      </label>
      <h3 className="font-semibold">Services / offerings</h3>
      {(value.offerings || []).map((offer, i) => (
        <fieldset className="rounded-xl border border-border p-4" key={i}>
          <legend className="px-2 text-xs">Offering {i + 1}</legend>
          <label className="block text-sm">
            Title
            <input
              value={offer.title}
              className="my-2 w-full rounded-lg border border-border-strong bg-paper p-2"
              onChange={(e) =>
                onChange({
                  ...value,
                  offerings: (value.offerings || []).map((o, j) =>
                    j === i ? { ...o, title: e.target.value } : o,
                  ),
                })
              }
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              value={offer.description}
              className="mt-2 w-full rounded-lg border border-border-strong bg-paper p-2"
              onChange={(e) =>
                onChange({
                  ...value,
                  offerings: (value.offerings || []).map((o, j) =>
                    j === i ? { ...o, description: e.target.value } : o,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="mt-3 text-sm text-primary underline"
            onClick={() =>
              onChange({
                ...value,
                offerings: (value.offerings || []).filter((_, j) => j !== i),
              })
            }
          >
            Remove offering {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={(value.offerings || []).length >= 12}
        className="rounded-xl border border-border-strong p-3 text-sm"
        onClick={() =>
          onChange({
            ...value,
            offerings: [
              ...(value.offerings || []),
              { title: "", description: "" },
            ],
          })
        }
      >
        Add offering
      </button>
    </div>
  );
}
