import Link from "next/link";
import { DomainMarketplace } from "@/components/domains/domain-marketplace";
import { publicPrices } from "@/lib/domains/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Domains | JKTL Business",
  description:
    "Buy and manage a domain with one-off payments. View current registration and renewal prices. Domain registration, renewal and DNS support through JKTL.",
};
export default async function Page() {
  let prices: Record<string, unknown>[] = [];
  let unavailable = false;
  try {
    prices = await publicPrices();
  } catch {
    unavailable = true;
  }
  return (
    <>
      <nav className="flex items-center justify-between bg-[#060e2a] p-5 text-sm text-white">
        <Link href="https://jktl.com.ng">JKTL Business</Link>
        <Link href="/login?next=domains">Sign in</Link>
      </nav>
      <DomainMarketplace
        publicPage
        initialPrices={prices}
        unavailable={unavailable}
      />
    </>
  );
}
