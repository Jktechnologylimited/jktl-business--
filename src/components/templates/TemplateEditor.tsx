"use client";
import { useState } from "react";
import Link from "next/link";
import {
  getWebsiteTemplate,
  templateDraft,
  parseWebsiteDocument,
  templateLoginPath,
  type WebsiteDocument,
} from "@/lib/website-templates";
import { clearPendingTemplate } from "@/lib/template-selection";
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
        <h1 className="font-display text-2xl">Sign in to edit this website</h1>
        <p className="mt-3">Your template selection is preserved.</p>
        <Link
          className="mt-4 inline-block text-primary underline"
          href={templateLoginPath(template.id)}
        >
          Sign in →
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
      {label}
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/business/website"
            className="text-xs text-primary underline"
          >
            ← Website settings
          </Link>
          <h1 className="mt-2 font-display text-2xl text-ink">
            {template.name} · Website editor
          </h1>
        </div>
        <Link
          href="/business/templates"
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Choose another template
        </Link>
      </div>
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
        This template is loaded as an unsaved draft. Review the starter copy and
        images before publishing. Saving changes an existing live site only when
        “Publish website” is enabled. Business records are not replaced.
      </p>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <details
            open
            className="rounded-xl border border-border bg-surface p-5"
          >
            <summary className="cursor-pointer font-semibold">
              Identity & hero
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
                  update("heroImage", `/template-art/${template.id}.svg`)
                }
              >
                Use bundled template artwork
              </button>
              <p className="text-xs text-ink-muted">
                Use an image you have permission to publish. Images that cannot
                load fall back to the bundled artwork.
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
              About your business
            </summary>
            <div className="mt-5 space-y-4">
              {text("aboutTitle", "About heading", false, 200)}
              {text("aboutText", "About text", true, 5000)}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              Services, programmes or collections
            </summary>
            <div className="mt-5 space-y-5">
              {text("offeringsTitle", "Section heading", false, 160)}
              {content.offerings.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <legend className="text-xs text-ink-muted">
                    Item {i + 1}
                  </legend>
                  <label className="block text-sm">
                    Title
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
                    Description
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
                      Remove item
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
                  Add item
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">Gallery</summary>
            <div className="mt-5 space-y-5">
              {text("galleryTitle", "Gallery heading", false, 160)}
              {content.gallery.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <legend className="text-xs">Image {i + 1}</legend>
                  <label className="block text-sm">
                    HTTPS image URL
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
                    Caption & accessible description
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
                      Remove image
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
                        src: `/template-art/${template.id}.svg`,
                        alt: "Add your image description",
                      },
                    ])
                  }
                >
                  Add image
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              Your approach
            </summary>
            <div className="mt-5 space-y-4">
              {text("featureTitle", "Heading", false, 240)}
              {text("featureText", "Description", true, 2000)}
              <label className="block text-sm">
                Steps (one per line)
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
              Frequently asked questions
            </summary>
            <div className="mt-5 space-y-5">
              {text("faqTitle", "Section heading", false, 160)}
              {content.faqs.map((item, i) => (
                <fieldset
                  key={i}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <label className="block text-sm">
                    Question
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
                    Answer
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
                      Remove question
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
                  Add question
                </button>
              )}
            </div>
          </details>
          <details className="rounded-xl border border-border bg-surface p-5">
            <summary className="cursor-pointer font-semibold">
              Contact section
            </summary>
            <div className="mt-5 space-y-4">
              {text("contactTitle", "Contact heading", false, 240)}
              {text("contactText", "Contact introduction", true, 2000)}
              <p className="text-xs text-ink-muted">
                Email, phone and address come from your existing business
                profile.{" "}
                <Link
                  href="/business/settings"
                  className="underline text-primary"
                >
                  Update your business details
                </Link>
                .
              </p>
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
              Publish website
              <span className="block mt-1 text-xs text-ink-muted">
                When enabled, saving makes this design and content visible on
                your existing website address. Turn it off to save without
                publishing.
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
            <h2 className="font-semibold mb-3">Live preview</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <TemplateCanvas
                template={template}
                document={content}
                contact={profile}
              />
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              The same layout and saved content render on your published site.
              No template is published until you save.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
