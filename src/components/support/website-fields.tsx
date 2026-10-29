"use client";
import { BeautyFields } from "@/components/templates/BeautyFields";
import { templateDraft, type WebsiteDocument } from "@/lib/website-templates";
export function WebsiteFields({
  value,
  onChange,
  templateId,
}: {
  value: WebsiteDocument;
  templateId?: string;
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
      {value.beauty && <BeautyFields value={value} onChange={onChange} />}
      {templateId === "hair-salon" && !value.beauty && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm">
            The saved salon design is preserved. You can preview the updated
            multipage design while keeping this client&apos;s existing text,
            images and services. New sample sections remain labelled until
            replaced. Nothing is published until you save.
          </p>
          <button
            type="button"
            className="rounded-lg border border-border p-3"
            onClick={() =>
              onChange({ ...value, beauty: templateDraft("hair-salon").beauty })
            }
          >
            Preview updated salon design
          </button>
        </div>
      )}
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
      {value.beauty && (
        <>
          {(["accent", "paper", "ink"] as const).map((key) => (
            <label key={key} className="block text-sm">
              {key} colour
              <input
                type="color"
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="block text-sm">
            Gallery images and alt text (one image URL | description per line)
            <textarea
              className="mt-2 w-full border border-border bg-paper p-3"
              rows={6}
              value={value.gallery.map((g) => `${g.src} | ${g.alt}`).join("\n")}
              onChange={(e) =>
                onChange({
                  ...value,
                  gallery: e.target.value
                    .split("\n")
                    .filter(Boolean)
                    .map((line, i) => {
                      const [src, ...alt] = line.split(" | ");
                      return {
                        src,
                        alt: alt.join(" | "),
                        category: value.gallery[i]?.category,
                      };
                    }),
                })
              }
            />
          </label>
          <label className="block text-sm">
            Social links (platform | HTTPS URL per line)
            <textarea
              className="mt-2 w-full border border-border bg-paper p-3"
              value={(value.socials || [])
                .map((g) => `${g.platform} | ${g.url}`)
                .join("\n")}
              onChange={(e) =>
                onChange({
                  ...value,
                  socials: e.target.value
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                      const [platform, ...url] = line.split(" | ");
                      return { platform, url: url.join(" | ") };
                    }),
                })
              }
            />
          </label>
          <label className="block text-sm">
            Client testimonials (name | quote | rating from 1 to 5 per line)
            <textarea
              className="mt-2 w-full border border-border bg-paper p-3"
              value={(value.reviews || [])
                .map((g) => `${g.name} | ${g.quote} | ${g.rating}`)
                .join("\n")}
              onChange={(e) =>
                onChange({
                  ...value,
                  reviews: e.target.value
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                      const parts = line.split(" | ");
                      return {
                        name: parts[0] || "",
                        quote: parts.slice(1, -1).join(" | "),
                        rating: Number(parts[parts.length - 1]),
                      };
                    }),
                })
              }
            />
          </label>
        </>
      )}
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
