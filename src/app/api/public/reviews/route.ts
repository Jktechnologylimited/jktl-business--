import { query } from "@/lib/support/service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(
      {
        reviews: await query(
          `SELECT id,quote,rating,display_name,company,milestone FROM business_reviews WHERE status='PUBLISHED' AND public_consent=true ORDER BY moderated_at DESC LIMIT 12`,
          [],
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { reviews: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
