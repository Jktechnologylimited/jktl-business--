import { redirect } from "next/navigation";
import { guardAdminPage } from "@/lib/admin-page-guard";

/** Keep saved links working; client management now lives in Custom Projects. */
export default async function AdminClientsPage() {
  await guardAdminPage("manage_custom");
  redirect("/admin/custom-projects");
}
