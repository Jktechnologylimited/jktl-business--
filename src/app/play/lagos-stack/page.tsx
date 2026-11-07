import type { Metadata } from "next";
import { LagosStack } from "@/components/arcade/LagosStack";
export const metadata: Metadata = {
  title: "Lagos Stack | JKTL Games",
  description:
    "Build a skyline, one perfect floor at a time. Play free, with no account required. Your best score stays on this device.",
  alternates: { canonical: "https://games.jktl.com.ng/play/lagos-stack" },
};
export default function Page() {
  return <LagosStack />;
}
