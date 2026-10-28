"use client";
import { useCallback, useState } from "react";
import styles from "./TemplatePreview.module.css";
import { useResponsivePreview } from "./useResponsivePreview";
import { Monitor, Smartphone } from "lucide-react";
import { createPortal } from "react-dom";
import { TemplateWebsite, type TemplateContact } from "./TemplateWebsite";
import type { WebsiteTemplate, WebsiteDocument } from "@/lib/website-templates";
export function TemplateCanvas({
  template,
  document: content,
  contact,
  readOnly = false,
  title = "Your website live preview",
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact: TemplateContact;
  readOnly?: boolean;
  title?: string;
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const prepareDocument = useCallback((target: Document) => {
    // Use the same styles and portal renderer as the existing editor. Copy
    // once per document; switching devices does not navigate or reset drafts.
    if (!target.head.querySelector("[data-preview-styles]")) {
      document.head
        .querySelectorAll('link[rel="stylesheet"],style')
        .forEach((node) => {
          const clone = node.cloneNode(true) as HTMLElement;
          clone.setAttribute("data-preview-styles", "");
          target.head.appendChild(clone);
        });
    }
    setMount(target.body);
  }, []);
  const { device, setDevice, frameRef } = useResponsivePreview(prepareDocument);
  return (
    <div className={styles.embedded}>
      <div className={styles.toolbar}>
        <div
          className={styles.devices}
          role="group"
          aria-label="Editor preview device"
        >
          {(["desktop", "mobile"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`${value} editor preview`}
              aria-pressed={device === value}
              onClick={() => setDevice(value)}
            >
              {value === "desktop" ? (
                <Monitor size={20} />
              ) : (
                <Smartphone size={20} />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.stage} data-device={device}>
        <iframe
          ref={frameRef}
          title={title}
          className={styles.frame}
          sandbox={readOnly ? "allow-same-origin" : undefined}
          referrerPolicy="no-referrer"
          style={{ background: content.paper }}
          srcDoc={
            '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"></head><body style="margin:0"></body></html>'
          }
        >
          {mount &&
            createPortal(
              <div className="jktl-light" inert={readOnly || undefined}>
                <TemplateWebsite
                  template={template}
                  document={content}
                  contact={contact}
                  preview
                />
              </div>,
              mount,
            )}
        </iframe>
      </div>
    </div>
  );
}
