import { guardAdminPage } from "@/lib/admin-page-guard";
import { adminDomainsAction } from "@/lib/actions/domain-order-actions";
import { DomainAdmin } from "@/components/domains/domain-admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_domains");
  const result = await adminDomainsAction();
  if (!result.ok)
    return (
      <section className="rounded-2xl border border-border p-6">
        <h1 className="text-2xl font-semibold">
          Domain operations unavailable
        </h1>
        <p className="mt-4 text-sm text-ink-muted">
          Apply domain migration 034 and check the Business database
          configuration. Existing website billing is unchanged.
        </p>
      </section>
    );
  return <DomainAdmin initial={result.data} />;
}
