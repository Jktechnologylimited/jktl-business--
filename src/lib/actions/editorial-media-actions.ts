"use server";
import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireAdminCapability } from "@/lib/admin-session";
import { getSql } from "@/lib/db/client";
import { rate } from "@/lib/support/service";
export async function uploadEditorialImageAction(f: FormData) {
  const a = await requireAdminCapability("manage_content");
  await rate("editorial-media:" + a.id, 10);
  const file = f.get("file"),
    alt = String(f.get("alt") || "").trim();
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 524288 ||
    !alt ||
    alt.length > 300 ||
    f.get("rights") !== "on"
  )
    throw Error(
      "Choose an image up to 512 KB, add its description and confirm image rights.",
    );
  const b = Buffer.from(await file.arrayBuffer());
  const mime = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : b[0] === 255 && b[1] === 216 && b[2] === 255
      ? "image/jpeg"
      : b.subarray(0, 4).toString() === "RIFF" &&
          b.subarray(8, 12).toString() === "WEBP"
        ? "image/webp"
        : "";
  if (!mime || mime !== file.type)
    throw Error("Choose a valid PNG, JPEG or WebP.");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw Error(
      "Image uploads are not configured. An approved HTTPS image URL can still be used.",
    );
  const blob = await put(
    "editorial/" +
      randomUUID() +
      "." +
      { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[mime],
    b,
    { access: "public", contentType: mime, addRandomSuffix: false },
  );
  try {
    await getSql()`INSERT INTO editorial_media(url,alt,created_by) VALUES(${blob.url},${alt},${a.id})`;
  } catch (e) {
    await del(blob.url).catch(() => {});
    throw e;
  }
  revalidatePath("/admin/content");
}
