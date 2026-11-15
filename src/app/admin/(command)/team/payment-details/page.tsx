import { guardAdminPage } from "@/lib/admin-page-guard";
import { PageHeader } from "@/components/app/page-header";
import { MyPaymentDetails } from "@/components/team-payments/payment-details";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My payment details",
  robots: { index: false, follow: false },
};
export default async function Page() {
  await guardAdminPage("manage_own_payment_details");
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="My payment details" />
      <MyPaymentDetails />
    </div>
  );
}
