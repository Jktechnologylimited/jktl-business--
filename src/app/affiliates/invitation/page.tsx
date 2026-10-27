import Link from "next/link";
import Image from "next/image";
import { createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { getSession } from "@/lib/session";
import { acceptAffiliateInvitationAction } from "@/lib/actions/affiliate-invitation-actions";
import { ActionForm } from "@/components/distribution/action-form";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return <p>Invalid invitation.</p>;
  const i = (
    await query(
      "SELECT name,message,terms,expires_at FROM affiliate_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()",
      [createHash("sha256").update(token).digest("hex")],
    )
  )[0];
  if (!i)
    return (
      <p>
        This invitation has expired or has already been used. Request a new
        invitation from the JKTL Team.
      </p>
    );
  const s = await getSession();
  const intent = "?next=affiliate-invite&invite=" + token;
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 text-ink">
      <Image src="/jktl-logo.png" alt="JKTL" width={72} height={72} />
      <h1 className="text-3xl font-semibold">
        Welcome to JKTL Affiliates, {String(i.name)}
      </h1>
      <p>{String(i.message)}</p>
      <p>
        Your proposed policy is shown below. Accepting this invitation creates
        Affiliate access. Commissions begin only under a separately accepted
        agreement formally activated by JKTL.
      </p>
      <pre className="overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm">
        {JSON.stringify(i.terms, null, 2)}
      </pre>
      {s ? (
        <ActionForm action={acceptAffiliateInvitationAction}>
          <input type="hidden" name="token" value={token} />
          <label className="flex gap-3">
            <input type="checkbox" name="consent" required />I have read and
            accept these proposed programme terms and understand that financial
            eligibility needs a formally activated agreement.
          </label>
          <button className="mt-4 rounded-lg bg-primary p-3 text-on-primary">
            Activate Affiliate access
          </button>
        </ActionForm>
      ) : (
        <div className="flex flex-wrap gap-4">
          <Link className="underline" href={"/signup" + intent}>
            Create an account and choose your password
          </Link>
          <Link className="underline" href={"/login" + intent}>
            Sign in with an existing JKTL account
          </Link>
        </div>
      )}
    </main>
  );
}
