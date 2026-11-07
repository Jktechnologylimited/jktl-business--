import type { Metadata } from "next";
import { WordMix } from "@/components/arcade/WordMix";
export const metadata: Metadata = {
  title: "Naija Word Mix | JKTL Games",
  description:
    "Unscramble a little Nigerian inspiration. Play free, with no account required. Your best score stays on this device.",
  alternates: { canonical: "https://games.jktl.com.ng/play/word-mix" },
};
export default function Page() {
  return <WordMix />;
}
