import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSql } from "@/lib/db/client";
import { parseGame } from "@/lib/tycoon";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { signedIn: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    const sql = getSql();
    const rows =
      await sql`SELECT document, revision FROM tycoon_saves WHERE user_id=${session.userId}`;
    return NextResponse.json(
      {
        signedIn: true,
        document: rows[0]?.document ?? null,
        revision: Number(rows[0]?.revision ?? 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Account saves are unavailable. Guest play is still open." },
      { status: 503 },
    );
  }
}
export async function PUT(req: NextRequest) {
  try {
    if (
      !req.headers.get("origin") ||
      new URL(req.headers.get("origin")!).host !== req.headers.get("host")
    )
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { error: "Sign in to save to your account." },
        { status: 401 },
      );
    const raw = await req.text();
    if (raw.length > 12000)
      return NextResponse.json({ error: "Save too large." }, { status: 413 });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid save." }, { status: 400 });
    }
    const document = parseGame(body.document);
    const revision = body.revision;
    if (!document || !Number.isSafeInteger(revision) || revision < 0)
      return NextResponse.json({ error: "Invalid save." }, { status: 400 });
    const sql = getSql();
    const rows =
      await sql`WITH changed AS (UPDATE tycoon_saves SET document=${JSON.stringify(document)}::jsonb,revision=revision+1,updated_at=now() WHERE user_id=${session.userId} AND revision=${revision} RETURNING revision), added AS (INSERT INTO tycoon_saves(user_id,document,revision) SELECT ${session.userId},${JSON.stringify(document)}::jsonb,1 WHERE ${revision}=0 ON CONFLICT(user_id) DO NOTHING RETURNING revision) SELECT revision FROM changed UNION ALL SELECT revision FROM added`;
    if (!rows.length)
      return NextResponse.json(
        {
          error:
            "A newer save exists. Reload your account save before saving again.",
        },
        { status: 409 },
      );
    return NextResponse.json({ ok: true, revision: Number(rows[0].revision) });
  } catch {
    return NextResponse.json(
      { error: "Could not save. Your game remains open; please retry." },
      { status: 503 },
    );
  }
}
