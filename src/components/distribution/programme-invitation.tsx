import "server-only";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { query } from "@/lib/custom/service";
import { getSession } from "@/lib/session";
import { acceptAffiliateInvitationAction } from "@/lib/actions/affiliate-invitation-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { invitationTerms } from "@/lib/distribution/invitation-terms";
export type InvitationSearch = Promise<{ token?: string }>;
export async function ProgrammeInvitation({
  program,
  searchParams,
}: {
  program: "partner" | "affiliate";
  searchParams: InvitationSearch;
}) {
  const { token } = await searchParams,
    name = program === "partner" ? "Partners" : "Affiliates";
  const frame = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-paper px-5 py-10 text-ink">
      <div className="mx-auto max-w-2xl space-y-6">
        <Image src="/jktl-logo.png" alt="JKTL" width={60} height={60} />
        {children}
      </div>
    </main>
  );
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return frame(
      <>
        <h1 className="text-3xl font-semibold">JKTL {name} invitation</h1>
        <p>This invitation link is invalid. Ask JKTL for a new invitation.</p>
      </>,
    );
  const invitation = (
    await query(
      "SELECT name,message,terms,expires_at,program FROM affiliate_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()",
      [createHash("sha256").update(token).digest("hex")],
    )
  )[0];
  if (!invitation)
    return frame(
      <>
        <h1 className="text-3xl font-semibold">JKTL {name} invitation</h1>
        <p>
          This invitation has expired or has already been used. Request a new
          invitation from the JKTL team.
        </p>
      </>,
    );
  const actual = invitation.program === "partner" ? "partner" : "affiliate";
  // Existing emails keep working, but the verified invitation determines its programme URL.
  if (actual !== program)
    redirect(
      `/${actual === "partner" ? "partners" : "affiliates"}/invitation?token=${token}`,
    );
  const session = await getSession(),
    terms = invitationTerms(invitation.terms),
    intent = `?next=${actual === "partner" ? "partner-invite" : "affiliate-invite"}&invite=${token}`;
  const expiry = new Date(String(invitation.expires_at)),
    expires = Number.isFinite(expiry.getTime())
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lagos",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(expiry)
      : null;
  return frame(
    <>
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          YOUR JKTL {name.toUpperCase()} INVITATION
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          Welcome to JKTL {name}, {String(invitation.name)}
        </h1>
        {Boolean(invitation.message) && (
          <p className="leading-relaxed text-ink-muted">
            {String(invitation.message)}
          </p>
        )}
      </header>
      <section
        className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
        aria-label="Proposed programme terms"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your proposed terms</h2>
          <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink-muted">
            Proposal · Not yet active
          </span>
        </div>
        {terms.length ? (
          <dl className="divide-y divide-border">
            {terms.map((term) => (
              <div key={term.label} className="py-4 first:pt-0 last:pb-0">
                <dt className="mb-1 text-sm font-semibold">{term.label}</dt>
                <dd className="m-0 text-sm leading-relaxed text-ink-muted">
                  {term.description}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">
            JKTL will provide your detailed commercial terms in a separate
            agreement.
          </p>
        )}
      </section>
      <section
        className="rounded-xl border border-border p-5 text-sm leading-relaxed"
        aria-label="What happens next"
      >
        <h2 className="mb-2 font-semibold">What happens next?</h2>
        <p>
          Accepting this invitation creates your{" "}
          {actual === "partner" ? "partner" : "affiliate"} profile.
          {actual === "partner"
            ? " Your partner application and agreed terms still require JKTL review."
            : ""}{" "}
          Commissions begin only under a separately accepted agreement formally
          activated by JKTL.
        </p>
        {expires && (
          <p className="mt-3 text-ink-muted">
            Your invitation expires on {expires} (WAT).
          </p>
        )}
      </section>
      {session ? (
        <ActionForm action={acceptAffiliateInvitationAction}>
          <input type="hidden" name="token" value={token} />
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input className="mt-1" type="checkbox" name="consent" required />
            <span>
              I have read and accept these proposed programme terms. I
              understand that earning eligibility requires a separately
              accepted, activated agreement.
            </span>
          </label>
          <button className="mt-5 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary">
            Accept {actual === "partner" ? "partner" : "affiliate"} invitation
          </button>
        </ActionForm>
      ) : (
        <div className="space-y-4">
          <Link
            className="inline-block rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
            href={"/signup" + intent}
          >
            Create an account and choose your password
          </Link>
          <p>
            <Link
              className="text-sm text-blue-600 underline"
              href={"/login" + intent}
            >
              Sign in with an existing JKTL account
            </Link>
          </p>
          <p className="text-xs text-ink-muted">
            Use the email address that received this invitation.
          </p>
        </div>
      )}
    </>,
  );
}
