import { gameWorldFeed } from "@/lib/game-world/feed";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function GET() {
  try {
    return Response.json(await gameWorldFeed(), {
      headers: {
        "Cache-Control": "public, s-maxage=30",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return Response.json(
      { error: "Game updates are temporarily unavailable." },
      { status: 503 },
    );
  }
}
