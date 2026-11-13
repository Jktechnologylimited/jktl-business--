"use client";
import { ArrowUpRight } from "lucide-react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { websiteTemplates, getWebsiteTemplate } from "@/lib/website-templates";
import { createBusinessWebsiteAction } from "@/lib/actions/multiple-website-actions";
import { addressSuggestions } from "@/lib/websites/model";
import { AddressPicker } from "./address-picker";
export function CreateWebsite({
  selected,
  businessName,
}: {
  selected: string;
  businessName: string;
}) {
  const router = useRouter(),
    [name, setName] = useState(businessName),
    [slug, setSlug] = useState(addressSuggestions(businessName)[0] || ""),
    [template, setTemplate] = useState(selected),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-6 rounded-2xl border border-border bg-paper p-5 sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const r = await createBusinessWebsiteAction({
            name,
            subdomain: slug,
            templateId: template,
          });
          if (!r.ok) {
            setError(r.error);
            setAvailable(false);
            return;
          }
          router.push("/business/website/template?site=" + r.id);
        } catch {
          setError("Could not create the website. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-6">
        <label className="block text-sm font-semibold">
          Website name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={160}
            className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
            placeholder="My business, online shop or campaign"
          />
        </label>
        <label className="block text-sm font-semibold">
          Starting design
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-paper p-3"
          >
            {websiteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === "blank-website"
                  ? "Custom design · blank website"
                  : t.id === "blank-landing"
                    ? "Custom design · blank landing page"
                    : t.name + " · " + t.category}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={"/templates/" + template}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Preview {getWebsiteTemplate(template)?.name} <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
          </a>
          <Link href="/business/templates" className="text-blue-600 underline">
            Browse visual template library
          </Link>
        </div>
        <AddressPicker
          value={slug}
          onChange={setSlug}
          onAvailable={setAvailable}
        />
        <p className="rounded-xl bg-surface p-4 text-sm leading-7 text-ink-muted">
          This creates a separate website draft. Your other websites stay
          intact. Add your content and publish from the editor when ready.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!available || busy}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {busy ? "Creating website…" : "Create website & start editing"}
        </button>
      </fieldset>
    </form>
  );
}
