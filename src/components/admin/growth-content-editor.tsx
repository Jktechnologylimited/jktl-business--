"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Eye, ImagePlus, Upload, X } from "lucide-react";
import { ActionForm } from "@/components/distribution/action-form";
import { saveGrowthDraftAction } from "@/lib/actions/growth-actions";
import { uploadEditorialImageAction } from "@/lib/actions/editorial-media-actions";
import { inlineGrowthImage, type GrowthMedia } from "@/lib/growth/content";
import { GrowthPublicationPreview } from "./growth-content-preview";

const input = "block w-full rounded-lg border border-border bg-paper p-3";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 disabled:opacity-50";
function initial(row: Record<string, unknown>, category?: string) {
  return {
    category: String(row.growth_category || category || "marketing"),
    kind: String(row.kind || "release"),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    excerpt: String(row.excerpt || ""),
    coverImage: String(row.cover_image || ""),
    link: String(row.growth_link || ""),
    body: String(row.body || ""),
  };
}

export function GrowthContentEditor({
  row = {},
  category,
  media,
  uploadsAvailable,
}: {
  row?: Record<string, unknown>;
  category?: "games" | "community";
  media: GrowthMedia[];
  uploadsAvailable: boolean;
}) {
  const [form, setForm] = useState(() => initial(row, category));
  const [preview, setPreview] = useState(false);
  const [images, setImages] = useState(media);
  const [alt, setAlt] = useState("");
  const [rights, setRights] = useState(false);
  const [placement, setPlacement] = useState("cover");
  const [notice, setNotice] = useState("");
  const [uploadError, setUploadError] = useState(false);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previewId = useId();
  const bodyId = useId();

  function insertImage(image: GrowthMedia, target: string) {
    setPreview(false);
    if (target === "cover") {
      setForm((current) => ({ ...current, coverImage: image.url }));
    } else {
      const start = bodyRef.current?.selectionStart;
      const end = bodyRef.current?.selectionEnd;
      setForm((current) => {
        const position = start ?? current.body.length;
        return {
          ...current,
          body:
            current.body.slice(0, position) +
            inlineGrowthImage(image) +
            current.body.slice(end ?? position),
        };
      });
    }
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (
      !file ||
      file.size < 1 ||
      file.size > 524288 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      !alt.trim() ||
      !rights
    ) {
      setUploadError(true);
      setNotice(
        "Choose a PNG, JPEG or WebP up to 512 KB, add a description and confirm image rights.",
      );
      return;
    }
    const data = new FormData();
    data.set("file", file);
    data.set("alt", alt);
    data.set("rights", "on");
    data.set("growthCategory", form.category);
    setNotice("");
    startUpload(async () => {
      try {
        const image = await uploadEditorialImageAction(data);
        setImages((current) =>
          [image, ...current.filter((i) => i.id !== image.id)].slice(0, 24),
        );
        insertImage(image, placement);
        setAlt("");
        setRights(false);
        if (fileRef.current) fileRef.current.value = "";
        setUploadError(false);
        setNotice(
          "Image uploaded and added to your draft. Save the draft before requesting approval.",
        );
      } catch (error) {
        unstable_rethrow(error);
        setUploadError(true);
        setNotice(
          error instanceof Error &&
            /^(Choose|Image uploads|Please wait)/.test(error.message)
            ? error.message
            : "Could not upload this image. Check your access and try again.",
        );
      }
    });
  }

  return (
    <div className="min-w-0 space-y-4">
      <ActionForm
        action={async (data) => {
          await saveGrowthDraftAction(data);
          if (!row.id) {
            setForm(initial({}, category));
            setPreview(false);
          }
        }}
        success="Unpublished draft saved. Open its saved revision preview below before approval or publishing."
        className="grid gap-4 rounded-xl border border-border p-5"
      >
        <fieldset disabled={uploading} className="grid min-w-0 gap-4">
          <input type="hidden" name="id" value={String(row.id || "")} />
          <input
            type="hidden"
            name="revision"
            value={Number(row.revision || 0)}
          />
          <label>
            Category
            <select
              name="category"
              className={input}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {(category ? [category] : ["marketing", "social", "landing"]).map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Destination
            <select
              name="kind"
              className={input}
              value={form.kind}
              disabled={!!row.id}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="release">Releases & Updates</option>
              <option value="blog">Blog</option>
            </select>
            {!!row.id && <input type="hidden" name="kind" value={form.kind} />}
          </label>
          {(
            [
              ["slug", "URL slug", 100, "e.g. new-games-this-week"],
              ["title", "Title", 180, "e.g. Discover this week’s new games"],
              ["excerpt", "Summary", 400, "A short introduction explaining what’s new and why it matters."],
            ] as const
          ).map(([key, label, max, placeholder]) => (
            <label key={key}>
              {label}
              <input
                className={input}
                name={key}
                required
                maxLength={max}
                placeholder={placeholder}
                pattern={key === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
                readOnly={key === "slug" && !!row.id}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <section
            aria-label="Content images"
            className="min-w-0 space-y-4 rounded-lg border border-border p-4"
          >
            <h4 className="flex items-center gap-2 font-semibold">
              <ImagePlus size={18} aria-hidden="true" />
              Content images
            </h4>
            <p className="text-sm text-ink-muted">
              Upload a cover or add images inside your content. Uploaded images
              are public assets, even while the article is a private draft. Use
              only images cleared for publication.
            </p>
            <input type="hidden" name="coverImage" value={form.coverImage} />
            <div
              aria-label="Selected cover image"
              className="space-y-3 rounded-lg border border-border bg-surface p-3"
            >
              <p className="text-sm font-semibold">Cover image · optional</p>
              {form.coverImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImage}
                    alt={images.find((image) => image.url === form.coverImage)?.alt || `Cover for ${form.title || "this announcement"}`}
                    className="max-h-64 w-full rounded-lg object-contain"
                  />
                  <button
                    type="button"
                    className={button}
                    onClick={() => setForm((current) => ({ ...current, coverImage: "" }))}
                  >
                    <X size={16} aria-hidden="true" />
                    Remove cover image
                  </button>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  No cover image selected. Upload an image or choose a previously uploaded image below.
                </p>
              )}
            </div>
            {uploadsAvailable ? (
              <>
                <label className="block">
                  Upload image · PNG, JPEG or WebP, up to 512 KB
                  <input
                    className={input}
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
                <label className="block">
                  Image description
                  <input
                    className={input}
                    maxLength={300}
                    placeholder="e.g. Players taking part in the JKTL community game night"
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                  />
                </label>
                <label className="block">
                  Add uploaded image as
                  <select
                    className={input}
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                  >
                    <option value="cover">Cover image</option>
                    <option value="body">Image in content</option>
                  </select>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={rights}
                    onChange={(e) => setRights(e.target.checked)}
                  />
                  I have permission to publish this image.
                </label>
                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading}
                  className={button}
                >
                  <Upload size={18} aria-hidden="true" />
                  {uploading ? "Uploading…" : "Upload image"}
                </button>
              </>
            ) : (
              <p role="status" className="text-sm">
                Image uploads are not configured yet. Ask the Owner to connect
                the existing media storage. You can still write and preview a
                draft or reuse previously uploaded images below.
              </p>
            )}
            {notice && (
              <p
                role={uploadError ? "alert" : "status"}
                className={uploadError ? "text-danger" : "text-ink-muted"}
              >
                {notice}
              </p>
            )}
            {images.length > 0 && (
              <details>
                <summary className="cursor-pointer font-semibold">
                  Reuse uploaded images
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="min-w-0 space-y-2 rounded-lg border border-border p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.alt}
                        loading="lazy"
                        className="h-28 w-full rounded object-cover"
                      />
                      <p className="break-words text-sm">{image.alt}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={button}
                          type="button"
                          onClick={() => insertImage(image, "cover")}
                        >
                          Use as cover
                        </button>
                        <button
                          className={button}
                          type="button"
                          onClick={() => insertImage(image, "body")}
                        >
                          Insert in content
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>
          <label htmlFor={bodyId}>Content (Markdown)</label>
          <textarea
            id={bodyId}
            ref={bodyRef}
            name="body"
            required
            maxLength={60000}
            rows={12}
            placeholder={"## What’s new\n\nWrite your announcement here. Use **bold** for key details.\n\n- First update\n- Second update\n\n[Explore JKTL games](https://jktl.com.ng/games)"}
            className={input}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <p className="text-sm text-ink-muted">
            Use Markdown for headings, lists, links and images. Preview renders
            the formatting; raw HTML is excluded.
          </p>
          <label>
            JKTL campaign destination · optional
            <input
              className={input}
              name="link"
              type="url"
              maxLength={2000}
              placeholder="https://jktl.com.ng/games"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={button}
              aria-expanded={preview}
              aria-controls={previewId}
              onClick={() => setPreview(!preview)}
            >
              <Eye size={18} aria-hidden="true" />
              {preview ? "Hide preview" : "Preview content"}
            </button>
            <button className="rounded-lg bg-primary px-4 py-3 text-on-primary">
              Save unpublished draft
            </button>
          </div>
        </fieldset>
      </ActionForm>
      {preview && (
        <section
          id={previewId}
          aria-label="Unsaved content preview"
          className="space-y-3"
        >
          <p className="text-sm text-ink-muted">
            Editor preview includes your current changes. Save before requesting
            approval; this preview does not publish anything.
          </p>
          <GrowthPublicationPreview content={form} />
        </section>
      )}
    </div>
  );
}
