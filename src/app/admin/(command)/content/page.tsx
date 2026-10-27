import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { editorialWorkspace } from "@/lib/db/publications";
import { EditorialManager } from "@/components/admin/editorial-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_content");
  const actor = await requireAdminCapability("manage_content");
  let workspace;
  try {
    workspace = await editorialWorkspace(actor);
  } catch {
    return (
      <div className="rounded-2xl border border-border p-6">
        <h1 className="text-xl font-semibold">Publishing is unavailable</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Check the database connection and apply migration 055 with npm run
          db:migrate, then reload. No posts have been changed.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">Editorial Team</h1>
      <p className="mt-3 mb-7 text-sm text-ink-muted">
        Write Columns, Blog articles, Releases and Updates in one workspace.
        Submit drafts for review and publish authorized, approved content.
      </p>
      <EditorialManager workspace={workspace} actor={actor} name={actor.name} />
    </div>
  );
}
