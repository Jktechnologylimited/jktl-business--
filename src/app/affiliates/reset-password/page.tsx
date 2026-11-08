import { redirect } from "next/navigation";
import { ProgrammeResetPage } from "@/components/auth/programme-reset";
import { programmeForResetToken } from "@/lib/db/affiliate-auth";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams,
    token = typeof query.token === "string" ? query.token : "";
  const actual = await programmeForResetToken(token);
  if (actual && actual !== "affiliate")
    redirect(`/partners/reset-password?token=${encodeURIComponent(token)}`);
  return <ProgrammeResetPage programme="affiliate" token={token} />;
}
