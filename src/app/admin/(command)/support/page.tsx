import Link from "next/link";
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
    <>
      <Link
        href="/admin/support/follow-ups"
        className="mb-4 mr-5 inline-block text-sm text-blue-600 underline"
      >
        Automatic journey → Human follow-ups
      </Link>
      <Link
        href="/admin/support/care"
        className="mb-4 inline-block text-sm text-blue-600 underline"
      >
        Founding customer setup & follow-up →
      </Link>
      <Suspense fallback={<p>Loading support inbox…</p>}>
        <StaffSupport />
      </Suspense>
    </>
  );
}
