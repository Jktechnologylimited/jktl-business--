import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { managedEditorAction } from "@/lib/actions/managed-site-actions";
import { ManagedSiteEditor } from "@/components/custom/managed-editor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Manage website | JKTL Business",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  if (!(await getSession())) redirect("/login?next=custom");
  const { projectId } = await params,
    result = await managedEditorAction(projectId);
  if (!result.ok)
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl">Manage website</h1>
        <p className="my-5">{result.error}</p>
        <Link href="/business/custom" className="underline">
          Back to My Projects
        </Link>
      </main>
    );
  const data = result.data;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm uppercase tracking-widest">
        JKTL Business / My Projects
      </p>
      <h1 className="my-5 text-3xl font-semibold">{data.name}</h1>
      <nav className="flex flex-wrap gap-5 text-sm underline">
        <Link href="/business/custom">My Projects</Link>
        <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer">
          View website
        </a>
        <Link href={`/business/help?project=${projectId}`}>
          Project support
        </Link>
      </nav>
      <ManagedSiteEditor
        projectId={projectId}
        manifest={data.manifest}
        websiteUrl={data.websiteUrl}
        draft={data.draft}
        revision={data.revision}
        scope={data.scopes}
      />
    </main>
  );
}
