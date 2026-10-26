import { currentBranding } from "@/lib/mail/service";
export async function GET() {
  return Response.json(
    { branding: await currentBranding() },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
