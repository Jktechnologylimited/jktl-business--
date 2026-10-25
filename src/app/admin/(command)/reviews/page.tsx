import { guardAdminPage } from "@/lib/admin-page-guard";
import { adminReviewsAction } from "@/lib/actions/review-actions";
import { ReviewManager } from "@/components/support/review-manager";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("publish_reviews");
  return <ReviewManager initial={await adminReviewsAction()} />;
}
