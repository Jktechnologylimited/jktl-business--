"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { Toggle } from "@/components/ui/toggle";
import { LogoUploadField } from "@/components/website/logo-upload-field";
import { ColorPicker } from "@/components/website/color-picker";
import { PublicSiteView } from "@/components/public-site/public-site-view";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { subdomainFormatError } from "@/lib/subdomain";
import { updateWebsiteSettingsAction } from "@/lib/actions/business-actions";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";

export default function WebsitePage() {
  const profile = useBusinessStore((s) => s.data.profile);
  const services = useBusinessStore((s) => s.data.services);
  const products = useBusinessStore((s) => s.data.products);
  const mode = useBusinessStore((s) => s.mode);
  const online = useBusinessStore((s) => s.online);
  const setWebsiteProfile = useBusinessStore((s) => s.setWebsiteProfile);
  const showToast = useToastStore((s) => s.show);

  const [subdomain, setSubdomain] = useState(profile.subdomain);
  const [tagline, setTagline] = useState(profile.tagline);
  const [themeColor, setThemeColor] = useState(profile.themeColor);
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logoUrl);
  const [published, setPublished] = useState(profile.published);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    subdomain !== profile.subdomain ||
    tagline !== profile.tagline ||
    themeColor !== profile.themeColor ||
    logoUrl !== profile.logoUrl ||
    published !== profile.published;

  const siteUrl = `https://${subdomain || "yourname"}.${ROOT_DOMAIN}`;

  const previewProfile = useMemo(
    () => ({
      displayName: profile.displayName,
      tagline,
      themeColor,
      logoUrl,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      city: profile.city,
      state: profile.state,
    }),
    [profile, tagline, themeColor, logoUrl],
  );

  async function save() {
    setError("");
    const cleanSubdomain = subdomain.trim().toLowerCase();
    const formatError = subdomainFormatError(cleanSubdomain);
    if (formatError) {
      setError(formatError);
      return;
    }

    if (mode !== "live") {
      // Demo mode has nothing real to publish to — just update local state
      // so the settings still feel usable when trying the app out.
      setWebsiteProfile({ ...profile, subdomain: cleanSubdomain, tagline: tagline.trim(), themeColor, logoUrl, published });
      showToast("Saved — you're in demo mode, so nothing was actually published");
      return;
    }

    setPending(true);
    const result = await updateWebsiteSettingsAction({ subdomain: cleanSubdomain, tagline, themeColor, logoUrl, published });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWebsiteProfile(result.data);
    setSubdomain(result.data.subdomain);
    setLogoUrl(result.data.logoUrl);
    showToast(result.data.published ? "Website published" : "Website settings saved");
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Website" />

      <section className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <Toggle
          label="Publish website"
          description={published ? "Live — anyone with the link can view it and book" : "Off — only you can preview it"}
          checked={published}
          onChange={setPublished}
        />

        {published ? (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            {siteUrl.replace("https://", "")} <ExternalLink className="size-3.5" />
          </a>
        ) : null}

        <div className="border-t border-border pt-4">
          <Field label="Website address" htmlFor="site-subdomain" hint={`Your site will be at ${siteUrl.replace("https://", "")}`}>
            <div className="flex items-center gap-2">
              <Input
                id="site-subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                placeholder="yourbusiness"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <span className="shrink-0 text-sm text-ink-muted">.{ROOT_DOMAIN}</span>
            </div>
          </Field>
        </div>

        <Field label="Logo" htmlFor="site-logo">
          <LogoUploadField businessName={profile.displayName} value={logoUrl} onChange={setLogoUrl} />
        </Field>

        <Field label="Tagline" htmlFor="site-tagline" hint="A short line shown under your business name">
          <Textarea id="site-tagline" rows={2} value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} />
        </Field>

        <Field label="Brand color" htmlFor="site-color">
          <ColorPicker value={themeColor} onChange={setThemeColor} />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!online && mode === "live" ? <p className="text-xs text-ink-muted">You&apos;re offline — reconnect to save website settings.</p> : null}

        <Button onClick={save} disabled={!dirty || pending || (mode === "live" && !online)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">Preview</h2>
        <p className="text-xs text-ink-muted">This is exactly what visitors will see. Booking is disabled in this preview.</p>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="max-h-[640px] overflow-y-auto">
            <PublicSiteView profile={previewProfile} services={services} products={products} subdomain={subdomain || "preview"} mode="preview" />
          </div>
        </div>
      </section>
    </div>
  );
}
