"use client";
import { TemplateCanvas } from "@/components/templates/TemplateCanvas";
import {
  getWebsiteTemplate,
  parseWebsiteDocument,
} from "@/lib/website-templates";
export function WebsiteDraftPreview({
  templateId,
  document: source,
}: {
  templateId: string;
  document: string;
}) {
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
      <h3 className="mb-3 font-semibold">Review before saving</h3>
      <TemplateCanvas
        template={template}
        document={parsed}
        contact={{}}
        readOnly
        title="Authorized website draft preview"
      />
      <p className="mt-3 text-xs text-ink-muted">
        Preview only. It does not save, publish, make bookings or record
        customer traffic.
      </p>
    </section>
  );
}
