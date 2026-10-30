"use server";
import { can } from "@/lib/admin-permissions";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/domains/store";
export type CorrectionKind = "affiliate" | "partner" | "team" | "customClient";
function kind(value: string): CorrectionKind {
  if (!["affiliate", "partner", "team", "customClient"].includes(value))
    throw Error("Invalid record type");
  return value as CorrectionKind;
}
export async function loadRecordCorrectionAction(
  type: CorrectionKind,
  record: string,
) {
  try {
    const k = kind(type);
    const acting = await requireAdminCapability(
      k === "affiliate" || k === "partner"
        ? "manage_affiliates"
        : k === "team"
          ? "manage_team"
          : "manage_custom",
    );
    const target = id(record);
    const rows =
      k === "affiliate" || k === "partner"
        ? await query(
            "SELECT jsonb_build_object('name',a.name,'email',a.email,'note',a.application_note) AS details,u.email AS linked_email FROM affiliates a LEFT JOIN distribution_account_links l ON l.affiliate_id=a.id LEFT JOIN users u ON u.id=l.user_id WHERE a.id=$1 AND a.programme=$2",
            [target, k],
          )
        : k === "team"
          ? await query(
              "SELECT jsonb_build_object('name',a.name,'email',a.email,'role',a.role) AS details,u.email AS linked_email FROM admin_users a LEFT JOIN users u ON u.id=a.business_user_id WHERE a.id=$1",
              [target],
            )
          : await query(
              "SELECT jsonb_build_object('businessName',o.name,'name',u.name,'email',u.email,'phone',COALESCE(u.phone,'')) AS details,u.email AS linked_email FROM custom_clients c JOIN organizations o ON o.id=c.organization_id JOIN users u ON u.id=c.user_id WHERE c.organization_id=$1",
              [target],
            );
    if (!rows[0]) throw Error("Record not found");
    return {
      ok: true as const,
      data: {
        canEditEmail: can(acting.role, "manage_team", acting.permissions),
        details: rows[0].details as Record<string, string>,
        linkedEmail: rows[0].linked_email ? String(rows[0].linked_email) : null,
      },
    };
  } catch {
    return {
      ok: false as const,
      error:
        "Could not load these details. Check your permissions and refresh.",
    };
  }
}
export async function saveRecordCorrectionAction(
  type: CorrectionKind,
  record: string,
  expected: Record<string, string>,
  details: Record<string, string>,
) {
  try {
    const k = kind(type),
      actor = await requireAdminCapability(
        k === "affiliate" || k === "partner"
          ? "manage_affiliates"
          : k === "team"
            ? "manage_team"
            : "manage_custom",
      );
    if (
      !expected ||
      !details ||
      typeof expected !== "object" ||
      typeof details !== "object" ||
      JSON.stringify(expected).length > 6000 ||
      JSON.stringify(details).length > 6000
    )
      throw Error("Invalid profile details");
    if (
      details.email?.trim().toLowerCase() !==
      expected.email?.trim().toLowerCase()
    )
      await requireAdminCapability("manage_team");
    await rateLimit(query, actor.id, "record-correction", 30, 60);
    const rows = await query(
      "SELECT correct_jktl_record($1,$2,$3::jsonb,$4::jsonb,$5) AS result",
      [
        k,
        id(record),
        JSON.stringify(expected),
        JSON.stringify(details),
        actor.id,
      ],
    );
    for (const path of [
      "/admin/affiliates",
      "/admin/partners",
      "/admin/team",
      "/admin/custom-projects",
      "/business/custom",
    ])
      revalidatePath(path);
    return {
      ok: true as const,
      data: rows[0].result as {
        details: Record<string, string>;
        sessionsRevoked: boolean;
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return {
      ok: false as const,
      error:
        /^(Record changed|Enter |Select |Keep |You cannot|That email|Only an owner|Profile note)/.test(
          msg,
        )
          ? msg
          : "Could not save these details. Check permissions, duplicate emails and the latest record, then retry.",
    };
  }
}
