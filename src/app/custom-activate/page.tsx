"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  inspectCustomInviteAction,
  activateCustomInviteAction,
} from "@/lib/actions/custom-project-actions";
import { JktlWordmark } from "@/components/app/logo";
function Activation() {
  const params = useSearchParams(),
    raw = params.get("token") || "";
  const [data, setData] = useState<Record<string, unknown> | null>(null),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    inspectCustomInviteAction(raw).then((r) => {
      if (active) {
        if (r.ok) setData(r.data);
        else setMessage(r.error);
      }
    });
    return () => {
      active = false;
    };
  }, [raw]);
  return (
    <main className="grid min-h-dvh place-items-center bg-[#060e2a] p-6">
      <section className="w-full max-w-lg rounded-3xl bg-[#fdfcf8] p-8 text-[#060e2a]">
        <JktlWordmark />
        <p className="mt-10 text-xs uppercase tracking-widest text-[#8b712d]">
          JKTL Custom
        </p>
        <h1 className="my-4 text-3xl font-semibold">
          {done ? "Your workspace is activated." : "Welcome to your workspace."}
        </h1>
        {message && (
          <p role="status" className="my-4">
            {message}
          </p>
        )}
        {done ? (
          <Link
            href="/login?next=custom"
            className="mt-6 block rounded-xl bg-[#060e2a] p-4 text-center text-white"
          >
            Sign in to JKTL Custom
          </Link>
        ) : (
          data && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  data.activation_required &&
                  f.get("password") !== f.get("confirm")
                ) {
                  setMessage("Passwords do not match.");
                  return;
                }
                setBusy(true);
                const r = await activateCustomInviteAction(
                  raw,
                  String(f.get("password") || ""),
                );
                setBusy(false);
                if (r.ok) setDone(true);
                else setMessage(r.error);
              }}
            >
              <p className="mb-6">{String(data.name)}</p>
              {data.activation_required ? (
                <>
                  <label className="my-4 block">
                    Create a password
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                    />
                  </label>
                  <label className="my-4 block">
                    Confirm password
                    <input
                      name="confirm"
                      type="password"
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                      className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                    />
                  </label>
                  <p className="text-xs">
                    Use at least 12 characters. The invitation verifies access
                    to your email and works once.
                  </p>
                </>
              ) : (
                <p className="my-4">
                  Already a JKTL customer?{" "}
                  <Link
                    href="/login?next=custom"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Sign in to your existing account
                  </Link>
                  , then return here to accept. Your password stays the same.
                </p>
              )}
              <button
                disabled={busy}
                className="mt-6 w-full rounded-xl bg-[#060e2a] p-4 text-white"
              >
                {busy ? "Activating…" : "Activate workspace"}
              </button>
            </form>
          )
        )}
      </section>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Activation />
    </Suspense>
  );
}
