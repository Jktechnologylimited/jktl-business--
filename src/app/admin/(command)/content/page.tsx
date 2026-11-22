import { WorkspaceUnavailable } from "@/components/admin/workspace-unavailable";
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
    return <WorkspaceUnavailable title="Editorial could not be loaded" detail="Check the database connection and publishing configuration, then try again. No posts have been changed." />;
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
