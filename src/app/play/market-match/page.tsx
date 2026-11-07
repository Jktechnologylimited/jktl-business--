import type { Metadata } from "next";
import { MarketMatch } from "@/components/arcade/MarketMatch";
export const metadata: Metadata = {
  title: "Market Match | JKTL Games",
  description:
    "Turn over a colourful Nigerian market. Play free, with no account required. Your best score stays on this device.",
  alternates: { canonical: "https://games.jktl.com.ng/play/market-match" },
};
export default function Page() {
  return <MarketMatch />;
}
