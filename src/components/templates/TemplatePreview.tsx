"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useResponsivePreview } from "./useResponsivePreview";
import { ArrowUpRight, Monitor, Smartphone } from "lucide-react";
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
          Select Template <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
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
function previewQuerySubscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
const previewQuerySnapshot = () => window.location.search;
const previewServerQuery = () => "";
export function RawTemplatePreview({
  id,
  pagePath = "",
  initialService = "",
}: {
  id: string;
  pagePath?: string;
  initialService?: string;
}) {
  const search = useSyncExternalStore(
    previewQuerySubscribe,
    previewQuerySnapshot,
    previewServerQuery,
  );
  const service =
    initialService || new URLSearchParams(search).get("service") || "";
  const template = getWebsiteTemplate(id);
  return template ? (
    <TemplateWebsite
      key={`${id}:${pagePath}:${service}`}
      template={template}
      document={template.document}
      preview
      pagePath={pagePath}
      initialService={service}
      basePath={`/template-canvas/${id}`}
    />
  ) : null;
}
