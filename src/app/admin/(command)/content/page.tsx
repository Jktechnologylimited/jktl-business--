import { guardAdminPage } from "@/lib/admin-page-guard";
import { listEditorial } from "@/lib/db/publications";
import { EditorialManager } from "@/components/admin/editorial-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_content");
  let articles;
  try {
    articles = await listEditorial();
  } catch {
    return (
      <div className="rounded-2xl border border-border p-6">
        <h1 className="text-xl font-semibold">Publishing is unavailable</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Check the database connection and apply migration 033 with npm run
          db:migrate, then reload. No posts have been changed.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">Blog & releases</h1>
      <p className="mt-3 mb-7 text-sm text-ink-muted">
        Write for the main JKTL website. Save privately as a draft, publish when
        ready, or return a live article to draft to unpublish it.
      </p>
      <EditorialManager initial={articles} />
    </div>
  );
}
