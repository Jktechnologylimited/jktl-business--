import { guardAdminPage } from "@/lib/admin-page-guard";
import { PageHeader } from "@/components/app/page-header";
import { TeamPaymentReview } from "@/components/team-payments/payment-details";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Team payment details",
  robots: { index: false, follow: false },
};
export default async function Page() {
  await guardAdminPage("manage_team_payments");
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Team payment details" />
      <TeamPaymentReview />
    </div>
  );
}
