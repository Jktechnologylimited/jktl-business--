import { LanguageSwitcher } from "@/components/i18n/LanguageProvider";
import type { Metadata } from "next";
import { WebsitePricing } from "@/components/pricing/WebsitePricing";
export const metadata: Metadata = {
  title: "Website Plans & Pricing | JKTL Business",
  description:
    "Start free. Compare Starter, Growth, Business and Business Elite with transparent monthly and yearly NGN pricing, included hosting and 200 website designs.",
  alternates: { canonical: "https://jktl.com.ng/pricing" },
};
export default function PricingPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <div className="mb-4 flex justify-end px-5">
        <LanguageSwitcher />
      </div>
      <WebsitePricing />
    </div>
  );
}
