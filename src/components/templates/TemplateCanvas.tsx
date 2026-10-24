"use client";
import { useRef, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div>
      <div
        role="group"
        aria-label="Editor preview device"
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          justifyContent: "center",
        }}
      >
        {(["desktop", "mobile"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`${value} editor preview`}
            aria-pressed={device === value}
            onClick={() => setDevice(value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #aab9ae",
              background: device === value ? "#112055" : "white",
              color: device === value ? "white" : "#112055",
            }}
          >
            {value === "desktop" ? (
              <Monitor size={20} />
            ) : (
              <Smartphone size={20} />
            )}
          </button>
        ))}
      </div>
      <div
        style={{
          overflow: "auto",
          display: "flex",
          justifyContent: device === "mobile" ? "center" : "flex-start",
          background: "#F9F7F0",
          padding: 12,
        }}
      >
        <iframe
          ref={frame}
          title="Your website live preview"
          style={{
            width: device === "mobile" ? 390 : "100%",
            maxWidth: device === "mobile" ? "100%" : undefined,
            minWidth: device === "desktop" ? 1024 : undefined,
            flexShrink: 0,
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
      </div>
    </div>
  );
}
