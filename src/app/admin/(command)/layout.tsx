import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { ROLE_LABEL, navFor } from "@/lib/admin-permissions";
import {
  isSchemaOutOfDateError,
  SCHEMA_OUT_OF_DATE_MESSAGE,
} from "@/lib/db/client";
import { adminLogoutAction } from "@/lib/actions/admin-actions";
import { OperationsFrame } from "@/components/admin/operations-frame";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession()
    .then((admin) => ({ admin, stale: false }))
    .catch((e) => {
      if (isSchemaOutOfDateError(e)) return { admin: null, stale: true };
      throw e;
    });
  if (session.stale)
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1>Database update required</h1>
        <p>{SCHEMA_OUT_OF_DATE_MESSAGE}</p>
      </div>
    );
  if (!session.admin) redirect("/admin/login");
  const admin = session.admin;
  return (
    <OperationsFrame
      name={admin.name}
      role={ROLE_LABEL[admin.role]}
      nav={navFor(admin.role, admin.permissions)}
      logout={adminLogoutAction}
    >
      {children}
    </OperationsFrame>
  );
}
