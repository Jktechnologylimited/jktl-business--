"use client";

import { useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpgradeSheet } from "@/components/settings/upgrade-sheet";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customDomainFormatError, verificationRecordName } from "@/lib/domain";
import {
  startCustomDomainVerificationAction,
  verifyCustomDomainAction,
  removeCustomDomainAction,
} from "@/lib/actions/domain-actions";
import type { BusinessProfile } from "@/lib/types";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";

/**
 * Self-contained — manages its own pending/error state and talks to the
 * domain actions directly (same shape as `BillingPanel`), rather than
 * folding into the Website page's single "Save changes" button: starting
 * and verifying a domain are their own multi-step, server-confirmed flow,
 * not a form field with a draft value.
 */
export function CustomDomainField({
  profile,
  subscriptionActive,
  mode,
}: {
  profile: BusinessProfile;
  subscriptionActive: boolean;
  mode: "demo" | "live";
}) {
  const setWebsiteProfile = useBusinessStore((s) => s.setWebsiteProfile);
  const showToast = useToastStore((s) => s.show);

  const [domainInput, setDomainInput] = useState(profile.customDomain);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState<{ recordName: string; recordValue: string } | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  if (!subscriptionActive) {
    return (
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-ink">Custom domain</p>
        <p className="mt-1 text-xs text-ink-muted">
          Point your own domain (e.g. www.yourbusiness.com) at this site instead of your jktl.com.ng address.
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setUpgrading(true)}>
          Upgrade
        </Button>
        <UpgradeSheet
          open={upgrading}
          onClose={() => setUpgrading(false)}
          reason="Point your own domain — like www.yourbusiness.com — at your JKTL site instead of your free jktl.com.ng address."
          mode={mode}
        />
      </div>
    );
  }

  async function start() {
    setError("");
    const formatError = customDomainFormatError(domainInput, ROOT_DOMAIN);
    if (formatError) {
      setError(formatError);
      return;
    }

    if (mode !== "live") {
      const domain = domainInput.trim().toLowerCase();
      setWebsiteProfile({ ...profile, customDomain: domain, customDomainVerified: false });
      setInstructions({ recordName: verificationRecordName(domain), recordValue: "jktl-domain-verify=demo-mode-token" });
      showToast("Saved — you're in demo mode, so nothing was actually verified");
      return;
    }

    setPending(true);
    const result = await startCustomDomainVerificationAction(domainInput);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWebsiteProfile(result.data.profile);
    setInstructions({ recordName: result.data.recordName, recordValue: result.data.recordValue });
  }

  async function verify() {
    setError("");

    if (mode !== "live") {
      setWebsiteProfile({ ...profile, customDomainVerified: true });
      showToast("Verified — you're in demo mode, so nothing was actually checked");
      return;
    }

    setPending(true);
    const result = await verifyCustomDomainAction();
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWebsiteProfile(result.data);
    setInstructions(null);
    showToast("Domain verified — add it in your Vercel project to go live");
  }

  async function remove() {
    setError("");
    setInstructions(null);

    if (mode !== "live") {
      setWebsiteProfile({ ...profile, customDomain: "", customDomainVerified: false });
      setDomainInput("");
      return;
    }

    setPending(true);
    const result = await removeCustomDomainAction();
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWebsiteProfile(result.data);
    setDomainInput("");
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium text-ink">Custom domain</p>
        <p className="mt-1 text-xs text-ink-muted">Point your own domain at this site instead of your jktl.com.ng address.</p>
      </div>

      {!profile.customDomain ? (
        <div className="flex items-center gap-2">
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="www.yourbusiness.com"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Button size="sm" onClick={start} disabled={pending || !domainInput.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Start
          </Button>
        </div>
      ) : profile.customDomainVerified ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border-strong p-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Check className="size-4 text-primary" /> {profile.customDomain}
          </span>
          <button type="button" onClick={remove} disabled={pending} className="text-ink-muted hover:text-danger" aria-label="Remove">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border-strong p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{profile.customDomain}</span>
            <button type="button" onClick={remove} disabled={pending} className="text-ink-muted hover:text-danger" aria-label="Cancel">
              <X className="size-4" />
            </button>
          </div>

          {instructions ? (
            <div className="rounded-lg bg-surface p-3 text-xs">
              <p className="text-ink-muted">Add this DNS TXT record at your domain registrar, then verify:</p>
              <dl className="mt-2 flex flex-col gap-1 font-mono">
                <div>
                  <dt className="text-ink-faint">Name</dt>
                  <dd className="break-all text-ink">{instructions.recordName}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Value</dt>
                  <dd className="break-all text-ink">{instructions.recordValue}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">Verification is pending — DNS can take a few minutes to propagate.</p>
          )}

          <div className="flex gap-2">
            {!instructions ? (
              <Button size="sm" variant="outline" onClick={start} disabled={pending}>
                Show instructions again
              </Button>
            ) : null}
            <Button size="sm" onClick={verify} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              I&apos;ve added it — Verify
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {profile.customDomainVerified ? (
        <p className="text-xs text-ink-muted">
          Verified — now add <span className="font-mono">{profile.customDomain}</span> to your Vercel project (Domains → Add) so
          it actually goes live.
        </p>
      ) : null}
    </div>
  );
}
