"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * A question you can tap to reveal its answer, styled as a small back-and-forth
 * chat exchange — the question sits in one bubble, and the answer drops in
 * below it in a second, indented bubble, like a reply.
 */
export function GuideBubble({
  question,
  answer,
  children,
  defaultOpen = false,
}: {
  question: string;
  /** Plain-paragraph answer. Ignored if `children` is given. */
  answer?: string[];
  /** Custom answer content, for guides that need more than paragraphs. */
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-ink">{question}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-muted transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="ml-4 rounded-2xl rounded-tl-sm bg-primary-soft px-4 py-3 text-sm text-ink">
          {children ? (
            children
          ) : (
            <div className="flex flex-col gap-2">
              {answer?.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
