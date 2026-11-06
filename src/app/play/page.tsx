import type { Metadata } from "next";
import { GameHub } from "@/components/games/GameHub";
export const metadata: Metadata = {
  title: "JKTL Games | Word Hunt, Street Run, Tycoon & Fantasy",
  description:
    "Find Nigerian words, outrun the masquerade, build a city or practice the stock market. Explore free JKTL games and switch between them in one place.",
};
export default function Page() {
  return (
    <GameHub
      business={
        process.env.GAME_BUSINESS_ORIGIN || "https://business.jktl.com.ng"
      }
      fantasy={process.env.FANTASY_APP_ORIGIN || "https://fantasy.jktl.com.ng"}
    />
  );
}
