import { currentBranding } from "@/lib/mail/service";
export async function GET() {
  const {
    senderDisplayName: _,
    senderEmail: __,
    defaultReplyTo: ___,
    categoryReplyTo: ____,
    verifiedReplyTo: _____,
    ...branding
  } = await currentBranding();
  void _;
  void __;
  void ___;
  void ____;
  void _____;
  return Response.json(
    { branding },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
