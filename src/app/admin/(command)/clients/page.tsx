import { PageHeader } from "@/components/app/page-header";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { listExistingClients } from "@/lib/db/prospects";
import { ClientAccountManager } from "@/components/admin/client-account-manager";

export const dynamic = "force-dynamic";

/**
 * Businesses that already bought a custom website or business email from JKTL.
 *
 * They are not leads: they have paid, and the email that works on them is "your
 * account is ready", not "I built you a website". Telling a client who paid us for
 * a site that their site is poor would be the single most damaging email this
 * system could send, so they are kept on their own surface with their own copy.
 */
export default async function AdminClientsPage() {
  await guardAdminPage("run_lead_engine");
  const clients = await listExistingClients();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Existing JKTL clients" />
      <p className="-mt-2 text-sm text-ink-muted">
        Businesses that already have a JKTL-built website or business email. Creating an account makes a real tenant and
        emails them a one-time link to set their password — no password is ever sent.
      </p>
      <ClientAccountManager clients={clients} />
    </div>
  );
}
