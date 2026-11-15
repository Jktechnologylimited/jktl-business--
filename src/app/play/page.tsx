import type { Metadata } from "next";
import { GameHub } from "@/components/games/GameHub";
export const metadata: Metadata = {
  title: "JKTL Games | Free Nigerian Arcade, Word & Business Games",
  description:
    "Jump through Kora Skybound, find Nigerian words, outrun the masquerade or build a city. Explore free JKTL games and switch between them in one place.",
};
export default function Page() {
  return (
    <GameHub
      business={
        process.env.GAME_BUSINESS_ORIGIN || "https://business.jktl.com.ng"
      }
    />
  );
}
