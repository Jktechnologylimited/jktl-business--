"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowUpRight,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useBusinessStore } from "@/lib/store";
import { listBusinessWebsitesAction } from "@/lib/actions/multiple-website-actions";
import { websiteNextStep } from "@/lib/websites/activation";
import type { WebsiteCard } from "@/lib/websites/model";
export function ActivationChecklist() {
  const mode = useBusinessStore((s) => s.mode);
  const [sites, setSites] = useState<WebsiteCard[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (mode !== "live") return;
    void listBusinessWebsitesAction()
      .then((r) => {
        if (active) setSites(r.sites);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [mode]);
  if (mode !== "live") return null;
  const next = sites ? websiteNextStep(sites) : null;
  async function share() {
    if (!next?.site?.published || !next.site.url) return;
    try {
      await navigator.clipboard.writeText(next.site.url);
      setMessage("Website link copied. Share it with your customers.");
    } catch {
      setMessage("Open your website and copy the address to share it.");
    }
  }
  const steps =
    next?.stage === "published"
      ? [
          {
            title: "Check business details and logo",
            description:
              "Keep your contact information and opening details current.",
            href: next.href,
          },
          {
            title: "Connect WhatsApp",
            description:
              "Add your real WhatsApp number in your template contact settings, where supported.",
            href: next.href,
          },
          {
            title: "Add products or services",
            description:
              "Replace example offerings, descriptions and photos with your own.",
            href: next.href,
          },
          {
            title: "Test customer enquiries",
            description:
              "Open your published contact page and verify the phone, email and enquiry links.",
            href: next.site?.url || "/business/website",
          },
          {
            title: "Connect a custom domain when ready",
            description:
              "Your free JKTL address remains available. An upgrade is optional.",
            href: "/business/domains",
          },
        ]
      : [];
  return (
    <section
      aria-labelledby="website-activation"
      className="rounded-2xl border border-primary/40 bg-paper p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Your next step
          </p>
          <h2
            id="website-activation"
            className="mt-2 text-xl font-semibold text-ink"
          >
            {next?.stage === "published"
              ? "Make your website work for you"
              : next?.stage === "custom"
                ? "Your Custom project, connected"
                : "Bring your business online"}
          </h2>
        </div>
        <Link
          href="/business/plans"
          className="inline-flex items-center gap-2 rounded-full bg-[#c9a84c] px-5 py-3 text-sm font-semibold text-[#060e2a] shadow-md"
        >
          Upgrade <ArrowUpRight size={16} />
        </Link>
      </div>
      {!next ? (
        <p className="mt-4 text-sm text-ink-muted" role="status">
          {error
            ? "Your website status could not be loaded. Open Your websites or contact support."
            : "Checking your website progress…"}
        </p>
      ) : (
        <>
          <p className="my-4 text-sm leading-6 text-ink-muted">
            {next.stage === "published"
              ? "Your website is published. Work through these next steps and share your address with customers."
              : next.stage === "custom"
                ? "Open your existing project to manage the services connected to your business. You can also create another website from Your websites."
                : "Choose a free template, personalise its pages and preview before publishing on an available JKTL subdomain. No paid plan is required to publish there."}
          </p>
          {next.stage !== "custom" && (
            <ol className="my-5 grid gap-3 text-sm sm:grid-cols-3">
              {[
                ["Choose a template", next.stage !== "choose"],
                ["Customise & preview", next.stage === "published"],
                ["Publish your website", next.stage === "published"],
              ].map(([title, done]) => (
                <li
                  key={String(title)}
                  className="flex items-center gap-2 text-ink"
                >
                  {done ? (
                    <CheckCircle2
                      className="size-4 shrink-0 text-primary"
                      aria-label="Completed"
                    />
                  ) : (
                    <Circle
                      className="size-4 shrink-0 text-ink-faint"
                      aria-label="Next step"
                    />
                  )}
                  {title}
                </li>
              ))}
            </ol>
          )}
          <Link
            href={next.href}
            className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
          >
            {next.label} →
          </Link>
          {next.site?.published && next.site.url && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <a
                href={next.site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 break-all text-blue-600 underline"
              >
                {next.site.url}
                <ExternalLink className="size-4 shrink-0" />
              </a>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-2 text-primary"
              >
                <Copy size={15} />
                Copy website link
              </button>
            </div>
          )}
          {steps.length > 0 && (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {steps.map((step) => (
                <li
                  key={step.title}
                  className="rounded-xl border border-border p-4"
                >
                  <a
                    href={step.href}
                    {...(step.href.startsWith("https://")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="text-sm font-semibold text-blue-600 underline"
                  >
                    {step.title}
                  </a>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    {step.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p role="status" className="mt-3 text-sm text-ink-muted">
        {message}
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/business/website" className="text-blue-600 underline">
          Your websites
        </Link>
        <Link href="/business/help" className="text-blue-600 underline">
          Get setup help
        </Link>
      </div>
    </section>
  );
}
