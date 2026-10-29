"use client";
import type {
  WebsiteDocument,
  BeautyContent,
  WebsiteOffering,
} from "@/lib/website-templates";
import { beautyPagePaths, beautyPageMeta } from "@/lib/website-templates";
export function BeautyFields({
  value,
  onChange,
}: {
  value: WebsiteDocument;
  onChange: (value: WebsiteDocument) => void;
}) {
  const b = value.beauty;
  if (!b) return null;
  const input =
    "mt-2 block w-full rounded-lg border border-border bg-paper p-3 text-ink";
  const update = (change: Partial<BeautyContent>) =>
    onChange({ ...value, beauty: { ...b, ...change } });
  const text = (
    label: string,
    content: string,
    change: (v: string) => void,
    max = 1200,
    type = "text",
  ) => (
    <label key={label} className="block text-sm">
      {label}
      {max > 500 || label.toLowerCase().includes("description") ? (
        <textarea
          className={input}
          value={content}
          maxLength={max}
          rows={3}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <input
          className={input}
          type={type}
          value={content}
          maxLength={max}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </label>
  );
  const offer = (index: number, change: Partial<WebsiteOffering>) =>
    onChange({
      ...value,
      offerings: value.offerings.map((s, i) =>
        i === index ? { ...s, ...change } : s,
      ),
    });
  return (
    <section className="space-y-6 rounded-xl border border-border p-4">
      <h3 className="text-lg font-semibold">Salon pages & details</h3>
      <p className="text-sm text-ink-muted">
        Business name, logo, main copy, colours, gallery and social links use
        the existing website fields. Changes stay in your draft until you save.
        Booking requests use your published details; your salon confirms
        availability.
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={b.demoContent}
          onChange={(e) => update({ demoContent: e.target.checked })}
        />
        Label content as demonstration material, including example prices, team
        and testimonials. Keep this on until you replace the sample information
        with your own.
      </label>
      {text(
        "About page photograph",
        b.aboutImage,
        (v) => update({ aboutImage: v }),
        2000,
      )}
      {text(
        "Salon philosophy — one point per line",
        b.philosophy.join("\n"),
        (v) => update({ philosophy: v.split("\n").filter(Boolean) }),
        2000,
      )}
      <h4 className="font-semibold">Contact information</h4>
      <p className="text-xs text-ink-muted">
        Blank contact fields use your business profile where available. Use an
        international number for WhatsApp, for example +234… .
      </p>
      {(["phone", "email", "address", "whatsapp", "mapUrl"] as const).map(
        (key) =>
          text(
            (
              {
                phone: "Phone",
                email: "Contact email",
                address: "Salon address",
                whatsapp: "WhatsApp number",
                mapUrl: "Map destination (HTTPS)",
              } as const
            )[key],
            b.contact[key],
            (v) => update({ contact: { ...b.contact, [key]: v } }),
            key === "mapUrl"
              ? 2000
              : key === "address"
                ? 500
                : key === "email"
                  ? 254
                  : 40,
          ),
      )}
      <h4 className="font-semibold">Opening hours</h4>
      {b.hours.map((h, i) => (
        <fieldset key={i} className="space-y-3 border-t border-border pt-3">
          <legend className="text-xs">Hours {i + 1}</legend>
          {text(
            "Day or days",
            h.day,
            (v) =>
              update({
                hours: b.hours.map((a, n) => (n === i ? { ...a, day: v } : a)),
              }),
            100,
          )}
          {text(
            "Hours",
            h.hours,
            (v) =>
              update({
                hours: b.hours.map((a, n) =>
                  n === i ? { ...a, hours: v } : a,
                ),
              }),
            100,
          )}
          <button
            type="button"
            onClick={() => update({ hours: b.hours.filter((_, n) => n !== i) })}
            className="text-sm underline"
          >
            Remove hours {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={b.hours.length >= 14}
        onClick={() =>
          update({
            hours: [...b.hours, { day: "New day", hours: "By appointment" }],
          })
        }
        className="rounded border border-border p-3 text-sm"
      >
        Add opening hours
      </button>
      <h4 className="font-semibold">Stylist profiles</h4>
      {b.stylists.map((s, i) => (
        <fieldset key={i} className="space-y-3 border-t border-border pt-3">
          <legend className="text-xs">Stylist {i + 1}</legend>
          {(["name", "role", "bio", "image"] as const).map((key) =>
            text(
              "Stylist " + key,
              s[key],
              (v) =>
                update({
                  stylists: b.stylists.map((a, n) =>
                    n === i ? { ...a, [key]: v } : a,
                  ),
                }),
              key === "image" ? 2000 : key === "bio" ? 1200 : 100,
            ),
          )}
          <button
            type="button"
            onClick={() =>
              update({ stylists: b.stylists.filter((_, n) => n !== i) })
            }
            className="text-sm underline"
          >
            Remove stylist {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={b.stylists.length >= 8}
        onClick={() =>
          update({
            stylists: [
              ...b.stylists,
              {
                name: "New stylist",
                role: "Stylist",
                bio: "Introduce your stylist.",
                image: b.aboutImage,
              },
            ],
          })
        }
        className="rounded border border-border p-3 text-sm"
      >
        Add stylist
      </button>
      <h4 className="font-semibold">Service page details</h4>
      <p className="text-xs text-ink-muted">
        Edit service names and descriptions in Services / offerings. Display
        prices are your website copy. Linked active services in Business use
        their authoritative booking price; other requests are enquiries until
        you confirm them.
      </p>
      {value.offerings.map((s, i) => (
        <fieldset key={i} className="space-y-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">
            {s.title || `Service ${i + 1}`}
          </legend>
          {(
            [
              "slug",
              "category",
              "duration",
              "price",
              "image",
              "preparation",
            ] as const
          ).map((key) =>
            text(
              (
                {
                  slug: "Page address (lowercase words with hyphens)",
                  category: "Service category",
                  duration: "Duration",
                  price: "Display price",
                  image: "Service photograph",
                  preparation: "Before the appointment",
                } as const
              )[key],
              s[key] || "",
              (v) => offer(i, { [key]: v }),
              key === "image"
                ? 2000
                : key === "preparation"
                  ? 1200
                  : key === "price"
                    ? 120
                    : 80,
            ),
          )}
          {text(
            "Benefits — one per line",
            (s.benefits || []).join("\n"),
            (v) => offer(i, { benefits: v.split("\n").filter(Boolean) }),
            2000,
          )}
        </fieldset>
      ))}
      <h4 className="font-semibold">Gallery categories</h4>
      {value.gallery.map((g, i) =>
        text(
          `Photo ${i + 1} category`,
          g.category || "",
          (v) =>
            onChange({
              ...value,
              gallery: value.gallery.map((a, n) =>
                n === i ? { ...a, category: v } : a,
              ),
            }),
          80,
        ),
      )}
      <h4 className="font-semibold">Search appearance for each page</h4>
      {beautyPagePaths(value).map((path) => {
        const meta = beautyPageMeta(value, path);
        const edit = (part: { title?: string; description?: string }) => {
          const current = { path, ...meta, ...part };
          const pages = [...b.pages.filter((p) => p.path !== path), current];
          if (path === "")
            onChange({
              ...value,
              seoTitle: current.title,
              seoDescription: current.description,
              beauty: { ...b, pages },
            });
          else update({ pages });
        };
        return (
          <fieldset
            key={path}
            className="space-y-3 border-t border-border pt-3"
          >
            <legend className="text-xs">/{path}</legend>
            {text("Page title", meta.title, (v) => edit({ title: v }), 100)}
            {text(
              "Meta description",
              meta.description,
              (v) => edit({ description: v }),
              320,
            )}
          </fieldset>
        );
      })}
    </section>
  );
}
