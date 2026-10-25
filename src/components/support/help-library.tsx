"use client";
import { useState } from "react";
import Link from "next/link";
import { AddToHomeScreenGuide } from "@/components/help/add-to-home-screen-guide";
import { HELP_GUIDES } from "@/lib/support/knowledge";
export function HelpLibrary() {
  const [q, setQ] = useState("");
  const guides = HELP_GUIDES.filter((g) =>
    [g.title, g.summary, ...g.tags, ...g.steps, ...g.problems]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <section className="space-y-5" style={{ overflowWrap: "anywhere" }}>
      <div>
        <h2 className="text-2xl font-semibold">Step-by-step help library</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Practical instructions, common errors and when to ask for specialist
          help. Updated for the current JKTL Business workflows.
        </p>
        <label className="mt-4 block text-sm">
          Search guides
          <input
            className="mt-2 w-full rounded-xl border border-border-strong bg-paper p-3 text-ink"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try domain, template, payment or email"
          />
        </label>
      </div>
      <p role="status" className="text-xs text-ink-muted">
        {guides.length} guides
      </p>
      {guides.map((g) => (
        <details
          id={g.id}
          key={g.id}
          className="scroll-mt-24 rounded-2xl border border-border bg-paper p-5"
        >
          <summary className="cursor-pointer text-lg font-semibold">
            {g.title}
          </summary>
          <p className="my-5 text-sm leading-7 text-ink-muted">{g.summary}</p>
          <ol className="list-decimal space-y-4 pl-5 text-sm leading-7">
            {g.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {g.id === "pwa" && (
            <div className="my-6">
              <AddToHomeScreenGuide />
            </div>
          )}
          <h3 className="mb-3 mt-6 font-semibold">If something goes wrong</h3>
          <ul className="list-disc space-y-3 pl-5 text-sm leading-7">
            {g.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div className="my-5 rounded-xl border border-border-strong bg-surface p-4 text-sm leading-7">
            <strong>When to escalate</strong>
            <p>{g.escalate}</p>
          </div>
          <Link
            className="text-sm font-semibold text-primary underline"
            href={g.route}
          >
            Open this area of Business →
          </Link>
        </details>
      ))}
    </section>
  );
}
