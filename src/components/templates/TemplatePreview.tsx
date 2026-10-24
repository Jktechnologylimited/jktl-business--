import Link from "next/link";
import {
  getWebsiteTemplate,
  templateLoginPath,
  templateEditorPath,
} from "@/lib/website-templates";
import { TemplateWebsite } from "./TemplateWebsite";
export function TemplatePreview({
  id,
  insideBusiness = false,
}: {
  id: string;
  insideBusiness?: boolean;
}) {
  const template = getWebsiteTemplate(id);
  if (!template) return null;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 20px",
          background: "#fff",
          color: "#14221b",
          borderBottom: "1px solid #ddd",
          fontFamily: "Arial,sans-serif",
          position: "sticky",
          top: 0,
          zIndex: 500,
          fontSize: 12,
        }}
      >
        <Link
          href={insideBusiness ? "/business/templates" : "/templates"}
          style={{ color: "inherit" }}
        >
          ← All templates
        </Link>
        <span style={{ textAlign: "center" }}>
          {template.name}
          <span style={{ display: "block", fontSize: 10, color: "#676c68" }}>
            Sample content · live preview
          </span>
        </span>
        <a
          href={
            insideBusiness
              ? templateEditorPath(id)
              : `https://business.jktl.com.ng${templateLoginPath(id)}`
          }
          style={{
            padding: "10px 19px",
            background: "#14291e",
            color: "#fff",
            borderRadius: 30,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Edit template ↗
        </a>
      </div>
      <TemplateWebsite
        template={template}
        document={template.document}
        preview
      />
    </>
  );
}
