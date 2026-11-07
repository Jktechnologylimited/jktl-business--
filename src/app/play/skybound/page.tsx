import type { Metadata } from "next";
import { SkyboundGame } from "@/components/skybound/SkyboundGame";
export const metadata: Metadata = {
  title: "Kora Skybound | Original JKTL Platform Adventure",
  description:
    "Jump across rooftops, gather sunstones and restore three beacons in Kora Skybound. Play JKTL’s original pixel-art platform adventure free on mobile or desktop.",
};
export default function Page() {
  return <SkyboundGame />;
}
