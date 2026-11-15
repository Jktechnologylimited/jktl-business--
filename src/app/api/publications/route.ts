import { NextRequest, NextResponse } from "next/server";
import { PUBLICATION_KINDS, type PublicationKind } from "@/lib/publications";
import { publishedArticles } from "@/lib/db/publications";
import { publicResponseCache, noResponseCache } from "@/lib/public-response-cache";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const slug = req.nextUrl.searchParams.get("slug") ?? undefined;
  const rawOffset = req.nextUrl.searchParams.get("offset") || "0";
  const offset = Number(rawOffset);
  if (
    !/^\d{1,6}$/.test(rawOffset) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000 ||
    !PUBLICATION_KINDS.includes(kind as PublicationKind) ||
    (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
  )
    return NextResponse.json(
      { error: "Invalid publication query." },
      { status: 400, headers: noResponseCache },
    );
  try {
    const articles = await publishedArticles(
      kind as PublicationKind,
      slug,
      offset,
    );
    if (slug && !articles.length)
      return NextResponse.json(
        { error: "Not found." },
        { status: 404, headers: noResponseCache },
      );
    return NextResponse.json(
      {
        articles,
        nextOffset: !slug && articles.length === 200 ? offset + 200 : null,
      },
      { headers: publicResponseCache() },
    );
  } catch {
    return NextResponse.json(
      { error: "Publications are temporarily unavailable." },
      { status: 503, headers: noResponseCache },
    );
  }
}
