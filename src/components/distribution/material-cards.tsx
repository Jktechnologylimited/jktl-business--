"use client";
import { useState } from "react";
import Image from "next/image";
type Material = {
  id: string;
  title: string;
  description: string;
  url: string;
  kind: string;
  product: string;
  copy: string;
  featured: boolean;
};
export function MaterialCards({
  items,
  referralUrl,
}: {
  items: Material[];
  referralUrl: string;
}) {
  const [product, setProduct] = useState("all"),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <label>
          Product
          <select
            className="ml-2 rounded border border-border bg-paper p-3"
            aria-label="Filter by product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="all">All products</option>
            {Array.from(new Set(items.map((i) => i.product))).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select
            className="ml-2 rounded border border-border bg-paper p-3"
            aria-label="Filter by format"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All formats</option>
            {Array.from(new Set(items.map((i) => i.kind))).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">{status}</p>
      <div className="grid gap-5 md:grid-cols-2">
        {items
          .filter(
            (i) =>
              (product === "all" || i.product === product) &&
              (kind === "all" || i.kind === kind),
          )
          .map((i) => {
            const copy = i.copy.replaceAll("{referralUrl}", referralUrl);
            return (
              <article
                key={i.id}
                className="space-y-3 overflow-hidden rounded-xl border border-border p-5"
              >
                {i.kind === "GRAPHIC" && (
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    <Image
                      unoptimized
                      src={i.url}
                      alt={i.title}
                      width={1080}
                      height={1080}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  </a>
                )}
                <h2 className="font-semibold">
                  {i.featured ? "Featured · " : ""}
                  {i.title}
                </h2>
                <p className="text-sm text-ink-muted">
                  {i.product} · {i.kind}
                </p>
                <p className="whitespace-pre-wrap">{copy || i.description}</p>
                <div className="flex flex-wrap gap-4">
                  <a
                    className="underline"
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={
                      i.kind === "GRAPHIC"
                        ? async (e) => {
                            e.preventDefault();
                            try {
                              const response = await fetch(i.url, {
                                credentials: "omit",
                              });
                              if (!response.ok) throw Error();
                              const blob = await response.blob();
                              const extension =
                                (
                                  {
                                    "image/svg+xml": "svg",
                                    "image/png": "png",
                                    "image/jpeg": "jpg",
                                    "image/webp": "webp",
                                  } as Record<string, string>
                                )[blob.type] || "image";
                              const href = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = href;
                              a.download =
                                i.title.replace(/[^a-z0-9_-]+/gi, "-") +
                                "." +
                                extension;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(
                                () => URL.revokeObjectURL(href),
                                10000,
                              );
                              setStatus("Graphic downloaded.");
                            } catch {
                              setStatus(
                                "Download could not start. Open the resource and save the image from your browser.",
                              );
                            }
                          }
                        : undefined
                    }
                    download={
                      i.kind === "GRAPHIC" ? i.title + ".svg" : undefined
                    }
                  >
                    {i.kind === "GRAPHIC"
                      ? "Download graphic"
                      : "Preview resource"}
                  </a>
                  {copy && (
                    <>
                      <button
                        type="button"
                        className="underline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(copy);
                            setStatus("Copied with your referral URL.");
                          } catch {
                            setStatus(
                              "Select the message text and copy it manually.",
                            );
                          }
                        }}
                      >
                        Copy message
                      </button>
                      <a
                        className="underline"
                        href={"https://wa.me/?text=" + encodeURIComponent(copy)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Share to WhatsApp
                      </a>
                      {
                        <button
                          type="button"
                          className="underline"
                          onClick={async () => {
                            try {
                              if (navigator.share)
                                await navigator.share({
                                  title: i.title,
                                  text: copy,
                                });
                              else {
                                await navigator.clipboard.writeText(copy);
                                setStatus("Copied for sharing.");
                              }
                            } catch {}
                          }}
                        >
                          Share
                        </button>
                      }
                    </>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
