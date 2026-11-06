import type { Metadata } from "next";
import { WordHunt } from "@/components/word-hunt/WordHunt";
export const metadata: Metadata = {
  title: "JKTL Word Hunt | A little challenge. A big brain break.",
  description:
    "Find hidden Nigerian places, foods and business words in JKTL Word Hunt. Free word-search puzzles with touch, mouse and keyboard play. No signup required.",
};
export default function Page() {
  return <WordHunt seed={20261106} />;
}
