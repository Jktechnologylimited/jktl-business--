"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useBusinessStore } from "@/lib/store";

export function BusinessSessionHandoff() {
  const router = useRouter();
  const resume = useBusinessStore((s) => s.resumeServerSession);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void resume()
      .then((result) => {
        if (!active) return;
        if (result.ok) router.replace("/business");
        else setError(result.error);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not open your workspace. Check your connection and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [resume, router]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Opening JKTL Business</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button
            className="rounded-lg border border-border p-3"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link className="text-blue-700 underline" href="/login">
            Sign in to another workspace
          </Link>
        </>
      ) : (
        <p role="status" className="flex items-center gap-3">
          <Loader2 className="animate-spin" aria-hidden="true" />
          Preparing your workspace with your existing account.
        </p>
      )}
    </main>
  );
}
