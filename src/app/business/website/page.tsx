"use client";
import { T } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { useState } from "react";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { useBusinessStore } from "@/lib/store";
import { getWebsiteTemplate } from "@/lib/website-templates";
import { CustomDomainField } from "@/components/website/custom-domain-field";
import { LogoUploadField } from "@/components/website/logo-upload-field";
import { updateWebsiteSettingsAction } from "@/lib/actions/business-actions";
import { subdomainFormatError } from "@/lib/subdomain";
export default function WebsitePage() {
  const profile = useBusinessStore((s) => s.data.profile);
  const mode = useBusinessStore((s) => s.mode);
  const infra = useBusinessStore((s) => s.data.infrastructure);
  const setProfile = useBusinessStore((s) => s.setWebsiteProfile);
  const [subdomain, setSubdomain] = useState(profile.subdomain);
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const template = getWebsiteTemplate(profile.websiteTemplateId);
  async function save() {
    setMessage("");
    const slug = subdomain.trim().toLowerCase();
    const error = subdomainFormatError(slug);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      if (mode !== "live") {
        setProfile({ ...profile, subdomain: slug, logoUrl });
        setMessage("Demo website settings saved.");
        return;
      }
      const result = await updateWebsiteSettingsAction({
        ...profile,
        subdomain: slug,
        logoUrl,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setProfile(result.data);
      setMessage("Website address and logo saved.");
    } catch {
      setMessage("Unable to save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <Link href="/business/domains" className="text-sm font-medium text-primary">Buy or connect a domain — keep your selected website →</Link>
      <h1 className="font-display text-3xl">
            <T>Websites & landing pages</T>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            <T>
              Choose a 2026 design, start blank, edit your content and measure
              published results.
            </T>
          </p>
        </div>
        <Link
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-primary"
          href="/business/website/metrics"
        >
          <T>View website metrics →</T>
        </Link>
      </div>
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">
          {template
            ? template.name
            : "Choose your website or landing-page design"}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {template
            ? `${profile.published ? "Published" : "Unpublished"} · ${profile.subdomain}.jktl.com.ng`
            : "The fixed-layout editor has been replaced by the template editor. Any existing published site stays online until you save a new design."}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-primary">
          <Link
            className="underline"
            href={`/business/website/template?template=${template?.id || "blank-website"}`}
          >
            {template ? "Edit selected template" : "Start a blank website"} →
          </Link>
          <Link
            className="underline"
            href="/business/website/template?template=blank-landing"
          >
            <T>Start a blank landing page →</T>
          </Link>
        </div>
      </section>
      <details className="rounded-xl border border-border bg-surface p-5">
        <summary className="cursor-pointer font-semibold">
          <T>Website address, business logo & custom domain</T>
        </summary>
        <div className="mt-5 space-y-5">
          <label className="block text-sm">
            <T>JKTL website address</T>
            <input
              className="mt-2 block w-full rounded-lg border border-border bg-paper p-3"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              autoCapitalize="off"
            />
          </label>
          <LogoUploadField
            businessName={profile.displayName}
            value={logoUrl}
            onChange={setLogoUrl}
          />
          <button
            disabled={busy}
            onClick={save}
            className="rounded-lg bg-primary px-4 py-3 text-sm text-white"
          >
            {busy ? "Saving…" : "Save address & logo"}
          </button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          <CustomDomainField
            profile={profile}
            subscriptionActive={
              mode !== "live" ||
              infra.entitled ||
              infra.subscriptionStatus === "active"
            }
            mode={mode}
          />
        </div>
      </details>
      <TemplateGallery insideBusiness />
    </div>
  );
}
