import { ActionForm } from "./action-form";
import { uploadMarketingGraphicAction } from "@/lib/actions/marketing-upload-actions";
export function MarketingUploadForm({ draft = false }: { draft?: boolean }) {
  return (
    <details className="rounded-xl border border-border p-5">
      <summary>Upload a promotional graphic</summary>
      <ActionForm
        action={uploadMarketingGraphicAction}
        className="mt-4 grid gap-3"
      >
        <label>
          Title
          <input
            className="block w-full rounded border border-border bg-paper p-3"
            name="title"
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <label>
          Image (PNG, JPEG or WebP, maximum 512 KB)
          <input
            className="mt-2 block w-full"
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </label>
        <label>
          Product
          <select
            className="ml-2 rounded border border-border bg-paper p-2"
            name="product"
          >
            {[
              "general",
              "website-builder",
              "templates",
              "domains",
              "business-email",
              "business-tools",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select
            className="ml-2 rounded border border-border bg-paper p-2"
            name="audience"
          >
            {["BOTH", "AFFILIATE", "PARTNER"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" name="rights" required />I confirm the asset
          rights, JKTL branding and product claims.
        </label>
        <p className="text-sm">
          {draft
            ? "Uploads are submitted for Owner approval."
            : "Approved uploads become available in the resource library."}
        </p>
        <button className="rounded border border-border p-3">
          {draft ? "Upload for review" : "Upload approved graphic"}
        </button>
      </ActionForm>
    </details>
  );
}
