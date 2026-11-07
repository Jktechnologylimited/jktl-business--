import type { Metadata } from "next";
import { MarketSlice } from "@/components/arcade/MarketSlice";
export const metadata: Metadata = {
  title: "Market Slice | JKTL Games",
  description:
    "Slice fruit. Dodge the hot coals. Play free, with no account required. Your best score stays on this device.",
  alternates: { canonical: "https://games.jktl.com.ng/play/market-slice" },
};
export default function Page() {
  return <MarketSlice />;
}
