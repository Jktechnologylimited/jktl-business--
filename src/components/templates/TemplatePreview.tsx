"use client";
import Link from "next/link";
import { useResponsivePreview } from "./useResponsivePreview";
import { Monitor, Smartphone } from "lucide-react";
import {
  getWebsiteTemplate,
  templateLoginPath,
  templateEditorPath,
} from "@/lib/website-templates";
import { TemplateWebsite } from "./TemplateWebsite";
import styles from "./TemplatePreview.module.css";
export function TemplatePreview({
  id,
  insideBusiness = false,
}: {
  id: string;
  insideBusiness?: boolean;
}) {
  const { device, setDevice, frameRef } = useResponsivePreview();
  const template = getWebsiteTemplate(id);
  if (!template) return null;
  // A raw preview route prevents recursive frames and retains the full renderer.
  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <Link href={insideBusiness ? "/business/templates" : "/templates"}>
          ← All templates
        </Link>
        <div className={styles.name}>
          {template.name}
          <small>Sample content · live preview</small>
        </div>
        <div
          className={styles.devices}
          role="group"
          aria-label="Preview device"
        >
          <button
            type="button"
            aria-label="Desktop preview"
            title="Desktop preview"
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor size={20} />
          </button>
          <button
            type="button"
            aria-label="Mobile preview"
            title="Mobile preview"
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone size={20} />
          </button>
        </div>
        <a
          className={styles.edit}
          href={
            insideBusiness
              ? templateEditorPath(id)
              : `https://business.jktl.com.ng${templateLoginPath(id)}`
          }
        >
          Select Template ↗
        </a>
      </header>
      <div className={styles.stage} data-device={device}>
        <iframe
          key={id}
          title={`${template.name} website preview`}
          ref={frameRef}
          src={`/template-canvas/${id}`}
          className={styles.frame}
        />
      </div>
    </div>
  );
}
export function RawTemplatePreview({ id }: { id: string }) {
  const template = getWebsiteTemplate(id);
  return template ? (
    <TemplateWebsite template={template} document={template.document} preview />
  ) : null;
}
