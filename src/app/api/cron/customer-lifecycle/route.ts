import { runLifecycle } from "@/lib/lifecycle/service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json(
      { error: "Scheduled job is not configured." },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== "Bearer " + secret)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runLifecycle(20000);
    return Response.json(result, {
      status:
        ("failed" in result && result.failed) ||
        ("unknown" in result && result.unknown)
          ? 207
          : 200,
    });
  } catch {
    return Response.json(
      { error: "Follow-up processing failed." },
      { status: 500 },
    );
  }
}
