"use client";
import { T } from "@/components/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getWebsiteTemplate,
  templateDraft,
  parseWebsiteDocument,
  templateLoginPath,
  type WebsiteDocument,
} from "@/lib/website-templates";
import {
  clearPendingTemplate,
  rememberTemplate,
  readTemplateSessionDraft,
  rememberTemplateSessionDraft,
} from "@/lib/template-selection";
import { useBusinessStore } from "@/lib/store";
import { saveWebsiteTemplateAction } from "@/lib/actions/website-template-actions";
import type { BusinessProfile } from "@/lib/types";
import { TemplateCanvas } from "./TemplateCanvas";
export function TemplateEditor({
  initialProfile,
  selectedId,
}: {
  initialProfile: BusinessProfile | null;
  selectedId: string;
}) {
  const storedProfile = useBusinessStore((s) => s.data.profile);
  const mode = useBusinessStore((s) => s.mode);
  const setProfile = useBusinessStore((s) => s.setWebsiteProfile);
  const profile = initialProfile || storedProfile;
  const template =
    getWebsiteTemplate(selectedId) ||
    getWebsiteTemplate(profile.websiteTemplateId) ||
    getWebsiteTemplate("law-firm")!;
  const [content, setContent] = useState<WebsiteDocument>(() => {
    const draft = readTemplateSessionDraft(
      profile.organizationId,
      template.id,
      profile.websiteRevision || 0,
    );
    if (draft) {
      try {
        return parseWebsiteDocument(draft);
      } catch {}
    }
    if (profile.websiteTemplateId === template.id && profile.websiteDocument) {
      try {
        return parseWebsiteDocument(profile.websiteDocument);
      } catch {}
    }
    return templateDraft(template.id, profile.displayName);
  });
  const [published, setPublished] = useState(Boolean(profile.published));
  const [revision, setRevision] = useState(profile.websiteRevision || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    rememberTemplate(template.id);
  }, [template.id]);
  useEffect(() => {
    rememberTemplateSessionDraft(
      profile.organizationId,
      template.id,
      revision,
      content,
    );
  }, [profile.organizationId, template.id, revision, content]);
  const update = <K extends keyof WebsiteDocument>(
    key: K,
    value: WebsiteDocument[K],
  ) => {
    setContent((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  if (mode === "live" && !initialProfile)
    return (
      <div className="rounded-xl border border-border p-6">
        <h1 className="font-display text-2xl">
          <T>Sign in to edit this website</T>
        </h1>
        <p className="mt-3">
          <T>Your template selection is preserved.</T>
        </p>
        <Link
          className="mt-4 inline-block text-primary underline"
          href={templateLoginPath(template.id)}
        >
          <T>Sign in →</T>
        </Link>
      </div>
    );
  async function save() {
    setError("");
    setMessage("");
    let document: WebsiteDocument;
    try {
      document = parseWebsiteDocument(content);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Please check the website content.",
      );
      return;
    }
    setBusy(true);
    if (mode !== "live") {
      setProfile({
        ...profile,
        websiteTemplateId: template.id,
        websiteDocument: document,
        websiteRevision: revision + 1,
        themeColor: document.accent,
        published,
      });
      setRevision(revision + 1);
      setMessage(
        "Saved in the demo. A real account is required to publish a live website.",
      );
      clearPendingTemplate();
      setBusy(false);
      return;
    }
    try {
      const result = await saveWebsiteTemplateAction({
        templateId: template.id,
        document,
        revision,
        published,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProfile(result.data);
      setRevision(result.data.websiteRevision || revision + 1);
      clearPendingTemplate();
      setMessage(
        result.data.published
          ? "Website saved and published."
          : "Website draft saved.",
      );
    } catch {
      setError(
        "Unable to save right now. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const field =
    "block mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-ink";
  const text = (
    key: keyof WebsiteDocument,
    label: string,
    large = false,
    max = 1000,
  ) => (
    <label key={key} className="block text-sm text-ink">
      <T>{label}</T>
      {large ? (
        <textarea
          className={field}
          value={String(content[key])}
          onChange={(e) => update(key, e.target.value as never)}
          rows={4}
          maxLength={max}
        />
      ) : (
        <input
          className={field}
          value={String(content[key])}
          onChange={(e) => update(key, e.target.value as never)}
          maxLength={max}
        />
      )}
    </label>
  );
  return (
    <div className="space-y-6">
      <div className="mb-4 flex justify-end">
        <Link href="/business/plans" className="text-sm text-primary underline">
          <T>Website plans — keep this design →</T>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/business/website"
            className="text-xs text-primary underline"
          >
            <T>← Website settings</T>
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">
            {template.name}
            <T>· Website editor</T>
          </h1>
        </div>
        <Link
          href="/business/templates"
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          <T>Choose another template</T>
        </Link>
      </div>
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
        <T>
          This template is loaded as an unsaved draft. Review the starter copy
          and images before publishing. Saving changes an existing live site
          only when “Publish website” is enabled. Business records are not
          replaced.
        </T>
      </p>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <details
            open
            className="rounded-xl border border-border bg-surface p-5"
          >
            <summary className="cursor-pointer font-semibold">
              <T>Identity & hero</T>
            </summary>
            <div className="mt-5 space-y-4">
              {text("brandName", "Website name", false, 120)}
              {text("eyebrow", "Introductory line", false, 160)}
              {text("headline", "Main headline", false, 240)}
              {text("intro", "Introduction", true)}
              {text("ctaLabel", "Main button label", false, 60)}
              {text("heroImage", "Hero image HTTPS URL", false, 2000)}
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() =>
                  update(
                    "heroImage",
                    `/template-art/${template.sourceId || template.id}.svg`,
                  )
                }
              >
                <T>Use bundled template artwork</T>
              </button>
              <p className="text-xs text-ink-muted">
                <T>
                  Use an image you have permission to publish. Images that
                  cannot load fall back to the bundled artwork.
                </T>
              </p>
              <div className="flex gap-4 flex-wrap">
                {(["accent", "paper", "ink"] as const).map((key) => (
                  <label key={key} className="text-xs">
                    {key === "paper"
                      ? "Background"
                      : key === "ink"
                        ? "Text"
                        : "Accent"}
                    <input
                      type="color"
                      value={content[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="block mt-2 h-10 w-16"
                    />
                  </label>
                ))}
              </div>
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>About your business</T>
            </summary>
            <div className="mt-5 space-y-4">
              {text("aboutTitle", "About heading", false, 200)}
              {text("aboutText", "About text", true, 5000)}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Services, programmes or collections</T>
            </summary>
            <div className="mt-5 space-y-5">
              {text("offeringsTitle", "Section heading", false, 160)}
              {content.offerings.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <legend className="text-xs text-ink-muted">
                    <T>Item </T>
                    {i + 1}
                  </legend>
                  <label className="block text-sm">
                    <T>Title</T>
                    <input
                      className={field}
                      value={item.title}
                      maxLength={120}
                      onChange={(e) =>
                        update(
                          "offerings",
                          content.offerings.map((v, n) =>
                            n === i ? { ...v, title: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <T>Description</T>
                    <textarea
                      className={field}
                      value={item.description}
                      maxLength={1200}
                      onChange={(e) =>
                        update(
                          "offerings",
                          content.offerings.map((v, n) =>
                            n === i ? { ...v, description: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  {content.offerings.length > 1 && (
                    <button
                      className="text-xs text-danger"
                      onClick={() =>
                        update(
                          "offerings",
                          content.offerings.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <T>Remove item</T>
                    </button>
                  )}
                </fieldset>
              ))}
              {content.offerings.length < 12 && (
                <button
                  className="text-sm text-primary underline"
                  onClick={() =>
                    update("offerings", [
                      ...content.offerings,
                      {
                        title: "New offering",
                        description: "Describe what your business offers.",
                      },
                    ])
                  }
                >
                  <T>Add item</T>
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Gallery</T>
            </summary>
            <div className="mt-5 space-y-5">
              {text("galleryTitle", "Gallery heading", false, 160)}
              {content.gallery.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <legend className="text-xs">
                    <T>Image </T>
                    {i + 1}
                  </legend>
                  <label className="block text-sm">
                    <T>HTTPS image URL</T>
                    <input
                      className={field}
                      value={item.src}
                      maxLength={2000}
                      onChange={(e) =>
                        update(
                          "gallery",
                          content.gallery.map((v, n) =>
                            n === i ? { ...v, src: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <T>Caption & accessible description</T>
                    <input
                      className={field}
                      value={item.alt}
                      maxLength={200}
                      onChange={(e) =>
                        update(
                          "gallery",
                          content.gallery.map((v, n) =>
                            n === i ? { ...v, alt: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  {content.gallery.length > 1 && (
                    <button
                      className="text-xs text-danger"
                      onClick={() =>
                        update(
                          "gallery",
                          content.gallery.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <T>Remove image</T>
                    </button>
                  )}
                </fieldset>
              ))}
              {content.gallery.length < 12 && (
                <button
                  className="text-sm text-primary underline"
                  onClick={() =>
                    update("gallery", [
                      ...content.gallery,
                      {
                        src: `/template-art/${template.sourceId || template.id}.svg`,
                        alt: "Add your image description",
                      },
                    ])
                  }
                >
                  <T>Add image</T>
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Your approach</T>
            </summary>
            <div className="mt-5 space-y-4">
              {text("featureTitle", "Heading", false, 240)}
              {text("featureText", "Description", true, 2000)}
              <label className="block text-sm">
                <T>Steps (one per line)</T>
                <textarea
                  className={field}
                  rows={5}
                  value={content.featureItems.join("\n")}
                  onChange={(e) =>
                    update(
                      "featureItems",
                      e.target.value.split("\n").slice(0, 12),
                    )
                  }
                />
              </label>
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Frequently asked questions</T>
            </summary>
            <div className="mt-5 space-y-5">
              {text("faqTitle", "Section heading", false, 160)}
              {content.faqs.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <label className="block text-sm">
                    <T>Question</T>
                    <input
                      className={field}
                      value={item.question}
                      maxLength={240}
                      onChange={(e) =>
                        update(
                          "faqs",
                          content.faqs.map((v, n) =>
                            n === i ? { ...v, question: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <T>Answer</T>
                    <textarea
                      className={field}
                      value={item.answer}
                      maxLength={2000}
                      onChange={(e) =>
                        update(
                          "faqs",
                          content.faqs.map((v, n) =>
                            n === i ? { ...v, answer: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  {content.faqs.length > 1 && (
                    <button
                      className="text-xs text-danger"
                      onClick={() =>
                        update(
                          "faqs",
                          content.faqs.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <T>Remove question</T>
                    </button>
                  )}
                </fieldset>
              ))}
              {content.faqs.length < 12 && (
                <button
                  className="text-sm text-primary underline"
                  onClick={() =>
                    update("faqs", [
                      ...content.faqs,
                      { question: "Your question", answer: "Your answer" },
                    ])
                  }
                >
                  <T>Add question</T>
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Contact section</T>
            </summary>
            <div className="mt-5 space-y-4">
              {text("contactTitle", "Contact heading", false, 240)}
              {text("contactText", "Contact introduction", true, 2000)}
              <p className="text-xs text-ink-muted">
                <T>
                  Email, phone and address come from your existing business
                  profile.
                </T>{" "}
                <Link
                  href="/business/settings"
                  className="underline text-primary"
                >
                  <T>Update your business details</T>
                </Link>
                .
              </p>
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Logo, service areas & SEO</T>
            </summary>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <T>Logo HTTPS URL</T>
                <input
                  className={field}
                  value={content.logoUrl || ""}
                  onChange={(e) => update("logoUrl", e.target.value)}
                  maxLength={2000}
                />
              </label>
              <p className="text-xs text-ink-muted">
                <T>
                  Your business logo is used when no template logo is set.
                  Otherwise a monogram is shown.
                </T>
              </p>
              <label className="block text-sm">
                <T>Service areas (one city or region per line)</T>
                <textarea
                  className={field}
                  rows={4}
                  value={(content.serviceAreas || []).join("\n")}
                  onChange={(e) =>
                    update(
                      "serviceAreas",
                      e.target.value.split("\n").filter(Boolean).slice(0, 30),
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                <T>Search title</T>
                <input
                  className={field}
                  value={content.seoTitle || ""}
                  onChange={(e) => update("seoTitle", e.target.value)}
                  maxLength={100}
                />
              </label>
              <label className="block text-sm">
                <T>Search description</T>
                <textarea
                  className={field}
                  value={content.seoDescription || ""}
                  onChange={(e) => update("seoDescription", e.target.value)}
                  maxLength={320}
                />
              </label>
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Social icons</T>
            </summary>
            <div className="mt-5 space-y-4">
              {(content.socials || []).map((item, i) => (
                <div key={i} className="space-y-2">
                  <select
                    aria-label={`Social platform ${i + 1}`}
                    className={field}
                    value={item.platform}
                    onChange={(e) =>
                      update(
                        "socials",
                        (content.socials || []).map((v, n) =>
                          n === i ? { ...v, platform: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    {[
                      "instagram",
                      "facebook",
                      "linkedin",
                      "youtube",
                      "tiktok",
                      "x",
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`Social URL ${i + 1}`}
                    className={field}
                    value={item.url}
                    placeholder="https://…"
                    onChange={(e) =>
                      update(
                        "socials",
                        (content.socials || []).map((v, n) =>
                          n === i ? { ...v, url: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <button
                    className="text-xs text-danger"
                    onClick={() =>
                      update(
                        "socials",
                        (content.socials || []).filter((_, n) => n !== i),
                      )
                    }
                  >
                    <T>Remove social link</T>
                  </button>
                </div>
              ))}
              {(content.socials || []).length < 8 && (
                <button
                  className="text-sm text-primary underline"
                  onClick={() =>
                    update("socials", [
                      ...(content.socials || []),
                      { platform: "instagram", url: "https://instagram.com/" },
                    ])
                  }
                >
                  <T>Add social icon</T>
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              <T>Reviews</T>
            </summary>
            <p className="mt-3 text-xs text-ink-muted">
              <T>
                Publish only genuine feedback you have permission to use. Sample
                reviews in the preview are never saved automatically.
              </T>
            </p>
            <div className="mt-5 space-y-4">
              {(content.reviews || []).map((review, i) => (
                <fieldset key={i} className="space-y-2">
                  <label className="block text-sm">
                    <T>Customer name</T>
                    <input
                      className={field}
                      value={review.name}
                      maxLength={120}
                      onChange={(e) =>
                        update(
                          "reviews",
                          (content.reviews || []).map((v, n) =>
                            n === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <T>Review</T>
                    <textarea
                      className={field}
                      value={review.quote}
                      maxLength={2000}
                      onChange={(e) =>
                        update(
                          "reviews",
                          (content.reviews || []).map((v, n) =>
                            n === i ? { ...v, quote: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <T>Rating</T>
                    <select
                      className={field}
                      value={review.rating}
                      onChange={(e) =>
                        update(
                          "reviews",
                          (content.reviews || []).map((v, n) =>
                            n === i
                              ? { ...v, rating: Number(e.target.value) }
                              : v,
                          ),
                        )
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                          <T>stars</T>
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-xs text-danger"
                    onClick={() =>
                      update(
                        "reviews",
                        (content.reviews || []).filter((_, n) => n !== i),
                      )
                    }
                  >
                    <T>Remove review</T>
                  </button>
                </fieldset>
              ))}
              {(content.reviews || []).length < 20 && (
                <button
                  className="text-sm text-primary underline"
                  onClick={() =>
                    update("reviews", [
                      ...(content.reviews || []),
                      { name: "", quote: "", rating: 5 },
                    ])
                  }
                >
                  <T>Add genuine review</T>
                </button>
              )}
            </div>
          </details>
          <label className="flex gap-3 items-start rounded-xl border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <T>Publish website</T>
              <span className="block mt-1 text-xs text-ink-muted">
                <T>
                  When enabled, saving makes this design and content visible on
                  your existing website address. Turn it off to save without
                  publishing.
                </T>
              </span>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-primary p-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? "Saving website…"
              : mode === "live"
                ? published
                  ? "Save & publish website"
                  : "Save website draft"
                : "Save demo website"}
          </button>
        </div>
        <section className="min-w-0">
          <div className="xl:sticky xl:top-5">
            <h2 className="font-semibold mb-3">
              <T>Live preview</T>
            </h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <TemplateCanvas
                template={template}
                document={content}
                contact={profile}
              />
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              <T>
                The same layout and saved content render on your published site.
                No template is published until you save.
              </T>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
