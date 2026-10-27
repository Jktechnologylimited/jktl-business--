"use server";
import { put, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
export async function uploadMarketingGraphicAction(f: FormData) {
  let a;
  try {
    a = await requireAdminCapability("manage_team");
  } catch {
    a = await requireAdminCapability("growth_resources");
  }
  await rate("marketing-upload:" + a.id, 10);
  const file = f.get("file"),
    title = String(f.get("title") || "").trim(),
    product = String(f.get("product")),
    audience = String(f.get("audience"));
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 524288 ||
    title.length < 3 ||
    title.length > 160 ||
    ![
      "general",
      "website-builder",
      "templates",
      "domains",
      "business-email",
      "business-tools",
    ].includes(product) ||
    !["BOTH", "AFFILIATE", "PARTNER"].includes(audience) ||
    f.get("rights") !== "on"
  )
    throw Error(
      "Choose a PNG, JPEG or WebP up to 512 KB and confirm the asset rights",
    );
  const b = Buffer.from(await file.arrayBuffer());
  let mime = "",
    ext = "";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mime = "image/png";
    ext = "png";
  } else if (b[0] === 255 && b[1] === 216 && b[2] === 255) {
    mime = "image/jpeg";
    ext = "jpg";
  } else if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  ) {
    mime = "image/webp";
    ext = "webp";
  }
  if (!mime || mime !== file.type)
    throw Error("Choose a valid PNG, JPEG or WebP image");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw Error(
      "Uploads are not configured. Use an approved HTTPS resource URL.",
    );
  const blob = await put("affiliate-materials/" + randomUUID() + "." + ext, b, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
  });
  try {
    await query(
      `WITH added AS(INSERT INTO distribution_assets(title,description,url,audience,created_by,enabled,kind,product) VALUES($1,'Uploaded JKTL promotional graphic',$2,$3,$4,$5,'GRAPHIC',$6) RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'MARKETING_GRAPHIC_UPLOADED',jsonb_build_object('asset',id,'published',$5::boolean) FROM added`,
      [title, blob.url, audience, a.id, a.role === "owner", product],
    );
  } catch (e) {
    try {
      await del(blob.url);
    } catch {}
    throw e;
  }
  revalidatePath("/admin/distribution/resources");
  revalidatePath("/admin/growth/resources");
  revalidatePath("/affiliates/resources");
  revalidatePath("/partners/resources");
}
