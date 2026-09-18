"use client";

import { useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { FilterTabs } from "@/components/app/filter-tabs";
import { GuideBubble } from "@/components/help/guide-bubble";
import { AddToHomeScreenGuide } from "@/components/help/add-to-home-screen-guide";
import { GUIDE_CATEGORIES, GUIDES } from "@/lib/guides";
import { useCurrentIndustry } from "@/lib/store";

const ALL = "all";

export default function HelpPage() {
  const industry = useCurrentIndustry();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GUIDES.filter((g) => {
      if (category !== ALL && g.category !== category) return false;
      if (!q) return true;
      const haystack = [g.question, ...g.answer, ...(g.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof GUIDES>();
    for (const g of filtered) {
      const list = byCategory.get(g.category) ?? [];
      list.push(g);
      byCategory.set(g.category, list);
    }
    return GUIDE_CATEGORIES.filter((c) => byCategory.has(c.id)).map((c) => ({ ...c, items: byCategory.get(c.id)! }));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Help & guides" />
      <p className="-mt-2 text-sm text-ink-muted">
        Answers to common questions about running {industry.productName} — tap any question to open it up.
      </p>

      <SearchInput value={query} onChange={setQuery} placeholder={'Search guides — e.g. "partial payment"'} />

      <FilterTabs
        options={[{ value: ALL, label: "All" }, ...GUIDE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
        value={category}
        onChange={setCategory}
      />

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <LifeBuoy className="size-6 text-ink-faint" />
          <p className="text-sm text-ink-muted">No guides match &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map((group) => (
            <section key={group.id} className="flex flex-col gap-2.5">
              <h2 className="font-display text-sm font-semibold text-ink">{group.label}</h2>
              <div className="flex flex-col gap-2.5">
                {group.items.map((item) =>
                  item.custom === "add-to-home-screen" ? (
                    <GuideBubble key={item.id} question={item.question}>
                      <div className="flex flex-col gap-3">
                        <p>{item.answer[0]}</p>
                        <AddToHomeScreenGuide />
                      </div>
                    </GuideBubble>
                  ) : (
                    <GuideBubble key={item.id} question={item.question} answer={item.answer} />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
