"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsubscribeProspectAction } from "@/lib/actions/prospect-actions";

/**
 * The unsubscribe page a prospect reaches from the footer of an outreach
 * email.
 *
 * It **requires a click** rather than unsubscribing on page load, because
 * mail clients and security scanners fetch links in emails before a human
 * ever sees them — a GET that suppressed the address would opt out prospects
 * who never opened the message. One extra tap is a small price for that.
 *
 * The token in the URL is the only credential, and it can only ever suppress
 * the one business it was minted for.
 */
export default function UnsubscribePage() {
  const [token] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") ?? ""));
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function confirm() {
    setState("working");
    const result = await unsubscribeProspectAction(token);
    if (result.ok) {
      setState("done");
      setMessage(`${result.data.businessName} will not be contacted again.`);
    } else {
      setState("error");
      setMessage(result.error);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-paper p-6 text-center">
        {state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto size-8 text-primary" />
            <h1 className="mt-3 font-display text-lg font-semibold text-ink">You&apos;re unsubscribed</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
          </>
        ) : (
          <>
            <MailX className="mx-auto size-8 text-ink-muted" />
            <h1 className="mt-3 font-display text-lg font-semibold text-ink">Stop hearing from us?</h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              We emailed you once, because your business is listed publicly on Google Maps. Confirm below and we will remove you from our list
              and not contact you again.
            </p>
            {state === "error" ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
            <Button className="mt-5" disabled={state === "working" || !token} onClick={() => void confirm()}>
              {state === "working" ? <Loader2 className="size-4 animate-spin" /> : null} Confirm unsubscribe
            </Button>
            {!token ? <p className="mt-2 text-xs text-ink-faint">This link is missing its token.</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
