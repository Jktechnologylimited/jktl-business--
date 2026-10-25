"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone } from "lucide-react";
import {
  getWebsiteTemplate,
  parseWebsiteDocument,
} from "@/lib/website-templates";
import { TemplateWebsite } from "@/components/templates/TemplateWebsite";
export function WebsiteDraftPreview({
  templateId,
  document: source,
}: {
  templateId: string;
  document: string;
}) {
  const [mobile, setMobile] = useState(false),
    [root, setRoot] = useState<HTMLElement | null>(null);
  let parsed;
  try {
    parsed = parseWebsiteDocument(JSON.parse(source));
  } catch {
    return (
      <p className="my-4 text-sm text-ink-muted">
        Complete the draft fields to show the website preview.
      </p>
    );
  }
  const template = getWebsiteTemplate(templateId);
  if (!template) return null;
  return (
    <section className="my-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="mr-auto font-semibold">Review before saving</h3>
        <button
          type="button"
          aria-label="Desktop draft preview"
          aria-pressed={!mobile}
          className="rounded-lg border border-border p-2"
          onClick={() => setMobile(false)}
        >
          <Monitor size={18} />
        </button>
        <button
          type="button"
          aria-label="Mobile draft preview"
          aria-pressed={mobile}
          className="rounded-lg border border-border p-2"
          onClick={() => setMobile(true)}
        >
          <Smartphone size={18} />
        </button>
      </div>
      <div className="overflow-auto rounded-xl border border-border bg-surface">
        <iframe
          title="Authorized website draft preview"
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          srcDoc={
            '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"></head><body style="margin:0"><div id="draft-root"></div></body></html>'
          }
          style={{
            display: "block",
            width: mobile ? "min(390px,100%)" : "100%",
            height: 550,
            border: 0,
            margin: "auto",
          }}
          onLoad={(event) => {
            const frame = event.currentTarget.contentDocument;
            if (!frame) return;
            window.document
              .querySelectorAll('link[rel="stylesheet"],style')
              .forEach((style) =>
                frame.head.appendChild(style.cloneNode(true)),
              );
            setRoot(frame.getElementById("draft-root"));
          }}
        />
        {root &&
          createPortal(
            <div className="jktl-light" inert>
              <TemplateWebsite template={template} document={parsed} preview />
            </div>,
            root,
          )}
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Preview only. It does not save, publish, make bookings or record
        customer traffic.
      </p>
    </section>
  );
}
