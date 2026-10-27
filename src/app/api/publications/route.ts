import { NextRequest, NextResponse } from "next/server";
import { PUBLICATION_KINDS, type PublicationKind } from "@/lib/publications";
import { publishedArticles } from "@/lib/db/publications";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const slug = req.nextUrl.searchParams.get("slug") ?? undefined;
  if (
    !PUBLICATION_KINDS.includes(kind as PublicationKind) ||
    (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
  )
    return NextResponse.json(
      { error: "Invalid publication query." },
      { status: 400 },
    );
  try {
    const articles = await publishedArticles(kind as PublicationKind, slug);
    if (slug && !articles.length)
      return NextResponse.json(
        { error: "Not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { articles },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Publications are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
