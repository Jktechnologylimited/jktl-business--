import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/client";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const rows =
      await getSql()`SELECT ep.slug,ep.display_name,ep.bio,ep.avatar_url FROM editorial_profiles ep WHERE ep.slug=${slug} AND EXISTS(SELECT 1 FROM jktl_publications p WHERE p.created_by=ep.user_id AND p.status='published' AND p.published_at<=now()) LIMIT 1`;
    return NextResponse.json(
      rows[0] ? { profile: rows[0] } : { error: "Not found." },
      {
        status: rows.length ? 200 : 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
