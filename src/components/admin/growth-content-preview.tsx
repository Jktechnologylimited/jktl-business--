"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  growthPublicationPath,
  type GrowthPreview,
} from "@/lib/growth/content";

export function GrowthPublicationPreview({
  content,
}: {
  content: GrowthPreview;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-5 overflow-hidden rounded-xl border border-border bg-paper p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Private preview ·{" "}
        {content.kind === "blog" ? "Blog" : "Releases & Updates"}
      </p>
      <p className="break-all text-sm text-ink-muted">
        Publication address:{" "}
        {growthPublicationPath(content.kind, content.slug || "your-title")}
      </p>
      {/^https:\/\//i.test(content.coverImage) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="max-h-96 w-full rounded-lg object-cover"
          src={content.coverImage}
          alt={content.title || "Cover image"}
        />
      )}
      <h2 className="break-words text-3xl font-semibold sm:text-4xl">
        {content.title || "Your title"}
      </h2>
      <p className="break-words text-lg text-ink-muted">{content.excerpt}</p>
      <p className="text-sm text-ink-muted">By JKTL</p>
      <div className="space-y-4 break-words leading-relaxed [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:overflow-auto [&_ul]:list-disc [&_ul]:pl-6">
        <ReactMarkdown
          skipHtml
          components={{
            img: ({ src, alt }) =>
              typeof src === "string" && /^https:\/\//i.test(src) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={alt || ""} loading="lazy" />
              ) : null,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {content.body}
        </ReactMarkdown>
      </div>
    </article>
  );
}

export function GrowthSavedPreview({
  content,
  revision,
  children,
}: {
  content: GrowthPreview;
  revision: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="space-y-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 font-semibold"
      >
        {open ? (
          <X size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
        {open ? "Close preview" : `Preview saved revision ${revision}`}
      </button>
      {open && (
        <section
          id={id}
          aria-label={`Saved revision ${revision} preview`}
          className="space-y-5"
        >
          <p className="text-sm text-ink-muted">
            This is saved revision {revision}. Unsaved editor changes are not
            included. Nothing goes live until the approved revision is
            published.
          </p>
          <GrowthPublicationPreview content={content} />
          {children}
        </section>
      )}
    </div>
  );
}
