"use server";
import { requireAdminCapability } from "@/lib/admin-session";
import { query } from "@/lib/custom/service";
import { text } from "@/lib/custom/model";
export async function featureAdminAction() {
  await requireAdminCapability("manage_features");
  return {
    features: await query(
      "SELECT * FROM feature_registry ORDER BY category,name",
    ),
    audit: await query(
      "SELECT * FROM feature_badge_audit ORDER BY id DESC LIMIT 100",
    ),
  };
}
export async function saveFeatureBadgeAction(input: {
  slug: string;
  revision: number;
  isNew: boolean;
  startsAt: string;
  endsAt: string;
}) {
  try {
    const a = await requireAdminCapability("manage_features");
    if (typeof input.isNew !== "boolean")
      throw Error("Select badge visibility.");
    const start = input.startsAt
        ? new Date(
            input.startsAt.length === 16
              ? input.startsAt + "+01:00"
              : input.startsAt,
          )
        : null,
      end = input.endsAt
        ? new Date(
            input.endsAt.length === 16 ? input.endsAt + "+01:00" : input.endsAt,
          )
        : null;
    if (
      (start && !Number.isFinite(start.getTime())) ||
      (end && !Number.isFinite(end.getTime())) ||
      (start && end && end <= start)
    )
      throw Error("Choose valid badge scheduling dates.");
    const rows = await query(
      `WITH changed AS(UPDATE feature_registry SET is_new=$3,starts_at=$4,ends_at=$5,revision=revision+1,updated_by=$6,updated_at=now() WHERE slug=$1 AND revision=$2 RETURNING *) INSERT INTO feature_badge_audit(feature_slug,actor_id,detail) SELECT slug,$6,jsonb_build_object('enabled',is_new,'startsAt',starts_at,'endsAt',ends_at,'revision',revision) FROM changed RETURNING id`,
      [
        text(input.slug, 60),
        input.revision,
        input.isNew,
        start?.toISOString() || null,
        end?.toISOString() || null,
        a.id,
      ],
    );
    if (!rows.length) throw Error("Reload the feature; its settings changed.");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof Error && /^(Choose |Select |Reload )/.test(e.message)
          ? e.message
          : "Could not save badge settings. Check team member access.",
    };
  }
}
export async function registerFeatureAction(input: {
  slug: string;
  name: string;
  category: string;
  route: string;
  description: string;
}) {
  try {
    const a = await requireAdminCapability("manage_features");
    if (
      !/^[a-z0-9-]{2,60}$/.test(input.slug) ||
      !/^\/[a-z0-9/_-]*$/.test(input.route) ||
      input.route.startsWith("//")
    )
      throw Error("Use a feature slug and a local route.");
    await query(
      "INSERT INTO feature_registry(slug,name,category,route,description,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
      [
        input.slug,
        text(input.name),
        text(input.category, 60),
        input.route,
        text(input.description, 500),
        a.id,
      ],
    );
    await query(
      "INSERT INTO feature_badge_audit(feature_slug,actor_id,detail) VALUES($1,$2,$3::jsonb)",
      [
        input.slug,
        a.id,
        JSON.stringify({ event: "REGISTERED", enabled: false }),
      ],
    );
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error:
        "Could not register feature. Check access, slug and route uniqueness.",
    };
  }
}
