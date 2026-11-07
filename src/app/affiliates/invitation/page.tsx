import {
  ProgrammeInvitation,
  type InvitationSearch,
} from "@/components/distribution/programme-invitation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your JKTL Affiliate invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: InvitationSearch;
}) {
  return ProgrammeInvitation({ program: "affiliate", searchParams });
}
