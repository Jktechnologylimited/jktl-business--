"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Copy, ArrowUpRight } from "lucide-react";
import { listBusinessWebsitesAction } from "@/lib/actions/multiple-website-actions";
import type { WebsiteCard } from "@/lib/websites/model";
export function SiteList({ mode }: { mode: "demo" | "live" }) {
  const [sites, setSites] = useState<WebsiteCard[]>([]),
    [loading, setLoading] = useState(mode === "live"),
    [error, setError] = useState(""),
    [manage, setManage] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (mode !== "live") return;
    void listBusinessWebsitesAction()
      .then((r) => {
        if (active) {
          setSites(r.sites);
          setManage(r.canManage);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Could not load your websites. Refresh the page or contact support.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [mode]);
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Your online presence
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Your websites</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
            Manage your websites, landing pages and connected Custom projects
            from one place. Each new template website has its own content and
            JKTL address.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/business/plans"
            className="inline-flex items-center gap-2 rounded-full bg-[#c9a84c] px-6 py-3 font-semibold text-[#060e2a] shadow-md ring-2 ring-[#c9a84c]/30"
          >
            Upgrade <ArrowUpRight size={18} />
          </Link>
          {(manage || mode !== "live") && (
            <Link
              href={
                mode === "live"
                  ? "/business/website/new"
                  : "/business/templates"
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
            >
              <Plus size={17} />
              Create website
            </Link>
          )}
        </div>
      </header>
      <div className="flex flex-wrap gap-5 text-sm">
        <Link href="/business/templates" className="text-blue-600 underline">
          Browse templates
        </Link>
        <Link href="/business/domains" className="text-blue-600 underline">
          Buy or connect a domain
        </Link>
        <Link
          href="/business/website/metrics"
          className="text-blue-600 underline"
        >
          Website metrics
        </Link>
        <Link href="/business/chatbot" className="text-blue-600 underline">
          Website chatbot
        </Link>
      </div>
      {loading && (
        <p
          role="status"
          className="rounded-xl border border-border bg-paper p-5"
        >
          Loading your websites…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-border bg-paper p-5 text-danger"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {!loading && !error && !sites.length && (
        <div className="rounded-2xl border border-border bg-paper p-7">
          <h2 className="text-xl font-semibold">
            Start your first website, then build more.
          </h2>
          <p className="my-4 text-sm leading-7 text-ink-muted">
            Choose an industry template, a blank website or a landing page.
            Reserve an available subdomain and publish when your content is
            ready.
          </p>
          <Link
            href={
              mode === "live" ? "/business/website/new" : "/business/templates"
            }
            className="text-sm font-semibold text-blue-600 underline"
          >
            Choose a starting point →
          </Link>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {sites.map((s) => (
          <article
            key={s.kind + "-" + s.id}
            className="flex flex-col rounded-2xl border border-border bg-paper p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-muted">
                  {s.kind === "custom"
                    ? "Managed Custom project"
                    : s.kind === "primary"
                      ? "Original business website"
                      : "Website / landing page"}
                </p>
                <h2 className="mt-2 text-xl font-semibold">{s.name}</h2>
              </div>
              <span className="rounded-full bg-surface px-3 py-2 text-xs font-semibold">
                {s.published ? "Published" : "Draft"}
              </span>
            </div>
            {s.url && (
              <div className="my-5 rounded-xl bg-surface p-4">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-semibold text-blue-600 underline"
                >
                  {s.url} ↗
                </a>
                {!s.published && (
                  <p className="mt-2 text-xs leading-6 text-ink-muted">
                    Reserved address. It becomes publicly available after
                    publishing.
                  </p>
                )}
                <button
                  type="button"
                  aria-label={"Copy website link for " + s.name}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(s.url);
                      setMessage("Website link copied.");
                    } catch {
                      setMessage("Select and copy the website address above.");
                    }
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold"
                >
                  <Copy size={14} />
                  Copy link
                </button>
              </div>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-3 text-sm">
              {manage && (
                <Link href={s.editUrl} className="font-semibold text-primary">
                  {s.kind === "custom"
                    ? "Open Custom workspace"
                    : "Edit website"}{" "}
                  →
                </Link>
              )}
              {s.published && s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 underline"
                >
                  View website
                  <ExternalLink size={14} />
                </a>
              )}
              {s.kind !== "custom" && (
                <Link
                  href={"/business/website/metrics?site=" + s.id}
                  className="text-blue-600 underline"
                >
                  Metrics
                </Link>
              )}
              <Link
                href={
                  s.kind === "template"
                    ? "/business/plans?site=" + s.id
                    : "/business/plans"
                }
                className="rounded-full bg-[#c9a84c] px-4 py-2 font-semibold text-[#060e2a]"
              >
                Upgrade ✦
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
