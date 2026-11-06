import Link from "next/link";
import { redirect } from "next/navigation";
import { owner, query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
import { ProjectEarn } from "../../../../../../packages/custom-portal/earn";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Earn with JKTL | Custom Projects",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await owner(),
    { projectId } = await params;
  const project = (
    await query(
      "SELECT name FROM custom_projects WHERE id=$1 AND organization_id=$2",
      [id(projectId), session.organizationId],
    )
  )[0];
  if (!project) redirect("/business/custom");
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href="/business/custom" className="underline">
        My Projects
      </Link>
      <h1 className="text-3xl font-semibold">{String(project.name)} · Earn</h1>
      <ProjectEarn endpoint={"/api/v1/custom-projects/" + projectId} />
    </main>
  );
}
