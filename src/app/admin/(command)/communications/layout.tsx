import { guardAdminPage } from "@/lib/admin-page-guard";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardAdminPage("compose_email");
  return children;
}
