import type { Metadata } from "next";
import { RunnerGame } from "@/components/runner/RunnerGame";
export const metadata: Metadata = {
  title: "JKTL Street Run | Outrun the masquerade",
  description:
    "Play JKTL Street Run: a free 3D masquerade chase. Collect coins, dodge vehicles, jump barriers, slide under signs and beat your best score.",
};
export default function Page() {
  return <RunnerGame />;
}
