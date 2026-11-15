import "server-only";
import { revalidateTag } from "next/cache";

export const managedSiteTag = (project: string) => "managed-site:" + project.toLowerCase();
export const managedOrganizationTag = (organization: string) =>
  "managed-sites-org:" + organization.toLowerCase();

/** Expire after the write commits; do not serve stale content after an edit. */
export function invalidateManagedSite(project: string, organization: string) {
  revalidateTag(managedSiteTag(project), { expire: 0 });
  revalidateTag(managedOrganizationTag(organization), { expire: 0 });
}

export function invalidateManagedOrganization(organization: string) {
  revalidateTag(managedOrganizationTag(organization), { expire: 0 });
}
