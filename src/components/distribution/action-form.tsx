"use client";
import { useActionState, type ReactNode } from "react";
export function ActionForm({
  action,
  children,
  className,
  success = "Saved successfully.",
}: {
  action: (f: FormData) => Promise<unknown>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, submit, pending] = useActionState(
    async (_: { message: string; error: boolean }, f: FormData) => {
      try {
        await action(f);
        return { message: success, error: false };
      } catch (e) {
        const message =
          e instanceof Error &&
          /^(Choose|Complete|Only|Read|Confirm|Check|Use|An existing|Application|No |Current|Invitation|Agreement|Payout|Commission|Activation|Could not|Verify|Sign in|Invalid|This product|Ticket|Provide|Accept|Record|Review|A reconciliation)/.test(
            e.message,
          )
            ? e.message
            : "Unable to complete this request. Check your access and current status, then retry.";
        return { message, error: true };
      }
    },
    { message: "", error: false },
  );
  return (
    <form action={submit} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p role="status">Saving…</p>}
      {state.message && (
        <p
          role={state.error ? "alert" : "status"}
          className={state.error ? "mt-3 text-danger" : "mt-3 text-ink-muted"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
