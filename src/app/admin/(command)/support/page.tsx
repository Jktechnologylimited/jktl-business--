import { Suspense } from "react";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { StaffSupport } from "@/components/support/staff-support";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "JKTL Support inbox",
  manifest: "/admin/support/manifest.webmanifest",
};
export default async function Page() {
  await guardAdminPage("manage_support");
  return (
    <Suspense fallback={<p>Loading support inbox…</p>}>
      <StaffSupport />
    </Suspense>
  );
}
