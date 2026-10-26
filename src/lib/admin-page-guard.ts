import "server-only";
import { redirect } from "next/navigation";
import { getAdminSession } from "./admin-session";
import { can, type AdminCapability } from "./admin-permissions";

/**
 * Guards an admin **page** by redirecting, not by throwing.
 *
 * The distinction matters. A server action should throw when the role is wrong —
 * it is being called directly and must fail loudly. A *page* should redirect: a
 * typed URL or a stale link is not an attack, and showing an error boundary to
 * somebody who simply navigated to the wrong tab is a poor way to say no.
 *
 * Without this, an affiliate manager who signs in and is sent to `/admin` gets a
 * stack trace, because the page's capability check throws inside a render.
 */
export async function guardAdminPage(
  capability: AdminCapability,
): Promise<void> {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");

  if (!can(admin.role, capability, admin.permissions)) {
    // Send them somewhere they can actually use, rather than a dead end. If they
    // cannot even see insights, the login page is the honest destination.
    redirect(
      can(admin.role, "growth_workspace")
        ? "/admin/growth"
        : can(admin.role, "manage_support")
          ? "/admin/support"
          : can(admin.role, "view_insights")
            ? "/admin/insights"
            : can(admin.role, "manage_content")
              ? "/admin/content"
              : "/admin/login",
    );
  }
}
