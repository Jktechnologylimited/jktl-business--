import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BusinessSessionHandoff } from "@/components/auth/business-session-handoff";
export const metadata = {
  title: "Open JKTL Business",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await getSession())) redirect("/login");
  return <BusinessSessionHandoff />;
}
