"use client";
import { useState } from "react";
import { inviteTeamUserAction } from "@/lib/actions/team-invitation-actions";
import { inviteAffiliateAction } from "@/lib/actions/affiliate-invitation-actions";
export function InviteUser({
  roles,
  policies,
  hours,
}: {
  roles: Record<string, string>;
  policies: Record<string, unknown>[];
  hours: number;
}) {
  const [role, setRole] = useState(Object.keys(roles)[0]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const program = role.startsWith("program:") ? role.slice(8) : "";
  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-paper p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          if (program) {
            f.set("program", program);
            await inviteAffiliateAction(f);
          } else {
            f.set("role", role);
            await inviteTeamUserAction(f);
          }
          setMessage(
            "Invitation submitted to the provider. This does not prove delivery. Refresh the invitation list to see its state.",
          );
        } catch (e) {
          setMessage(
            e instanceof Error ? e.message : "Could not create invitation.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Recipient name
        <input
          className="block w-full rounded border border-border bg-paper p-3"
          name="name"
          required
          maxLength={120}
        />
      </label>
      <label>
        Email address
        <input
          className="block w-full rounded border border-border bg-paper p-3"
          name="email"
          type="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        Assignable role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="ml-3 rounded border border-border bg-paper p-3"
        >
          {Object.entries(roles).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {program && (
        <label>
          Proposed programme policy
          <select
            name="policy"
            required
            className="ml-3 rounded border border-border bg-paper p-3"
          >
            <option value="">Choose a policy</option>
            {policies
              .filter((p) => String(p.program).toLowerCase() === program)
              .map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name)} · v{String(p.version)}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Optional message
        <textarea
          className="block w-full rounded border border-border bg-paper p-3"
          name="message"
          maxLength={2000}
        />
      </label>
      <label>
        Expires after (hours)
        <input
          className="ml-3 rounded border border-border bg-paper p-3"
          name="hours"
          type="number"
          min={1}
          max={168}
          defaultValue={hours}
          required
        />
      </label>
      <p>
        No temporary passwords are emailed. Existing account holders
        authenticate before accepting. Partner approval and financial agreements
        remain separate.
      </p>
      <button
        disabled={busy}
        className="rounded bg-primary p-3 text-on-primary"
      >
        Send invitation
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
