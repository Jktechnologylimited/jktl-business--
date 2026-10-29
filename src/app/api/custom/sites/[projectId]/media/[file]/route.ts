import { publicManagedSite } from "@/lib/custom/managed-site";
import { loadSiteMedia } from "@/lib/custom/site-store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; file: string }> },
) {
  try {
    const params = await context.params;
    if (
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.(?:jpg|png|webp)$/.test(
        params.file,
      )
    )
      throw Error();
    const access = await publicManagedSite(params.projectId),
      image = await loadSiteMedia(access, params.file.split(".")[0]);
    const expected = params.file.endsWith(".jpg")
      ? "image/jpeg"
      : params.file.endsWith(".png")
        ? "image/png"
        : "image/webp";
    if (image.type !== expected) throw Error();
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public,max-age=31536000,immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Image not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
