import { guideReply } from "@/lib/support/knowledge";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q =
    new URL(request.url).searchParams.get("q") || "Get my first free website";
  if (q.length > 500)
    return Response.json({ error: "Question too long" }, { status: 400 });
  const result = guideReply(q);
  return Response.json(
    {
      reply: result.reply,
      guides: result.guides.map((g) => ({
        id: g.id,
        title: g.title,
        summary: g.summary,
        steps: g.steps,
        problems: g.problems,
        escalate: g.escalate,
        route: g.route,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
