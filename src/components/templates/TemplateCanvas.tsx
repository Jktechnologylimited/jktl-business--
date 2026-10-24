"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TemplateWebsite, type TemplateContact } from "./TemplateWebsite";
import type { WebsiteTemplate, WebsiteDocument } from "@/lib/website-templates";
export function TemplateCanvas({
  template,
  document: content,
  contact,
}: {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact: TemplateContact;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  return (
    <iframe
      ref={frame}
      title="Your website live preview"
      style={{
        width: "100%",
        height: 720,
        border: 0,
        background: content.paper,
      }}
      srcDoc={
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"></body></html>'
      }
      onLoad={() => {
        const target = frame.current?.contentDocument;
        if (!target) return;
        document.head
          .querySelectorAll('link[rel="stylesheet"],style')
          .forEach((node) => target.head.appendChild(node.cloneNode(true)));
        setMount(target.body);
      }}
    >
      {mount &&
        createPortal(
          <TemplateWebsite
            template={template}
            document={content}
            contact={contact}
            preview
          />,
          mount,
        )}
    </iframe>
  );
}
