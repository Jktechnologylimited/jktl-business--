import { can, type AdminRole } from "./admin-permissions";
import type { Publication, PublicationInput } from "./publications";
export type EditorialActor = {
  id: string;
  role: AdminRole;
  permissions?: Record<string, boolean>;
};
export const official = (
  p: Pick<PublicationInput, "kind" | "sensitive" | "category">,
) =>
  p.kind === "release" ||
  p.sensitive ||
  ["security", "billing", "operations"].includes(
    (p.category || "").toLowerCase(),
  );
export function canPublish(
  a: EditorialActor,
  p: Pick<PublicationInput, "kind" | "sensitive" | "category">,
) {
  if (!can(a.role, "review_content", a.permissions)) return false;
  if (p.kind === "release" && !can(a.role, "publish_releases", a.permissions))
    return false;
  if (
    (p.sensitive ||
      ["security", "billing", "operations"].includes(
        (p.category || "").toLowerCase(),
      )) &&
    !can(a.role, "publish_sensitive_updates", a.permissions)
  )
    return false;
  return true;
}
export function checkEditorialChange(
  a: EditorialActor,
  next: PublicationInput,
  old: Publication | null,
) {
  if (!can(a.role, "manage_content", a.permissions))
    throw Error("Your role cannot access Editorial.");
  const reviewer = can(a.role, "review_content", a.permissions);
  if (
    old &&
    a.role !== "owner" &&
    (reviewer
      ? old.createdBy !== a.id && old.assignedTo !== a.id
      : old.createdBy !== a.id)
  )
    throw Error("Your role can edit only your own or assigned content.");
  if (!reviewer) {
    if (
      !["draft", "submitted"].includes(next.status) ||
      (old && !["draft", "revision_requested", "rejected"].includes(old.status))
    )
      throw Error(
        "Your role can edit drafts and submit for editorial review only.",
      );
    if (
      Boolean(next.featured) !== Boolean(old?.featured) ||
      (next.assignedTo || null) !== (old?.assignedTo || null) ||
      next.author !== (old?.author || next.author)
    )
      throw Error("Your role cannot assign or feature content.");
  }
  if (!old && !["draft", "submitted"].includes(next.status))
    throw Error("Save a draft before editorial review.");
  if (old && (old.slug !== next.slug || old.kind !== next.kind))
    throw Error("URL and article type cannot be changed after creation.");
  if (old && official(old) && a.role !== "owner" && !official(next))
    throw Error(
      "Official announcement restrictions can only be removed by an Owner.",
    );
  if (next.status === "approved") {
    if (!reviewer || !old || !["submitted", "in_review"].includes(old.status))
      throw Error("Submit content before approval.");
    if ((official(next) || (old && official(old))) && a.role !== "owner")
      throw Error(
        "Official releases and sensitive announcements require Owner approval.",
      );
  }
  if (
    ["in_review", "revision_requested", "rejected"].includes(next.status) &&
    (!reviewer ||
      !old ||
      !["submitted", "in_review", "approved"].includes(old.status))
  )
    throw Error("Choose a submitted article for review.");
  if (
    ["revision_requested", "rejected"].includes(next.status) &&
    !next.comment?.trim()
  )
    throw Error("Add editorial feedback before returning content.");
  if (["published", "scheduled"].includes(next.status)) {
    if (
      !old ||
      !["approved", "published", "scheduled"].includes(old.status) ||
      !old.approvedBy ||
      !canPublish(a, next)
    )
      throw Error(
        "Your role needs approval and publication permission for this destination.",
      );
    // An approved revision cannot be silently rewritten during publication.
    const fields = [
      "title",
      "subtitle",
      "excerpt",
      "body",
      "coverImage",
      "author",
      "category",
      "tags",
      "seoTitle",
      "metaDescription",
      "seriesSlug",
      "chapter",
      "product",
      "versionLabel",
      "features",
      "sensitive",
    ] as const;
    for (const key of fields)
      if (
        JSON.stringify(next[key] ?? (Array.isArray(old[key]) ? [] : "")) !==
        JSON.stringify(old[key] ?? "")
      )
        throw Error(
          "This article changed after approval. Save it as a draft and submit it again.",
        );
  }
  if (
    old &&
    ["published", "scheduled"].includes(old.status) &&
    !["published", "scheduled"].includes(next.status) &&
    !canPublish(a, old)
  )
    throw Error("Your role cannot withdraw this publication.");
  if (
    next.status === "unpublished" &&
    (!old ||
      !["published", "scheduled"].includes(old.status) ||
      !canPublish(a, old))
  )
    throw Error("Your role cannot unpublish this content.");
  if (
    old?.status === "published" &&
    next.status === "draft" &&
    !canPublish(a, old)
  )
    throw Error("Your role cannot withdraw this publication.");
}
