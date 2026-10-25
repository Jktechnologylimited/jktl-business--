import { emailPlans } from "@/lib/business-email/service";
import { EmailLanding } from "@/components/business-email/email-landing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "JKTL Business Email",
  description:
    "Professional email for businesses that mean business. Explore branded mailboxes, domain setup and email service management.",
};
export default async function Page() {
  let plans: Record<string, unknown>[] = [];
  try {
    plans = await emailPlans();
  } catch {}
  return <EmailLanding plans={plans} />;
}
