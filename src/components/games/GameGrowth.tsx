"use client";
import { useEffect, useState } from "react";
import type { Trend } from "@/lib/google-trends";
export function GameGrowth() {
  const [trends, setTrends] = useState<Trend[]>([]),
    [state, setState] = useState("Loading trending searches…"),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/game-trends", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        setTrends(data.trends || []);
        setState(
          data.trends?.length
            ? ""
            : "Trending searches are temporarily unavailable.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState("Trending searches are temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  return (
    <section
      aria-label="Trending topics and free websites"
      style={{
        background: "#060e2a",
        color: "#fff",
        padding: "20px clamp(16px,4vw,48px)",
        borderTop: "1px solid #c9a84c",
        overflowWrap: "anywhere",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ color: "#e6c76b", fontSize: 12, letterSpacing: 2 }}>
            PLAY. DISCOVER. CREATE.
          </p>
          <h2 style={{ fontSize: 22, margin: "6px 0" }}>
            Your next move could be your own website.
          </h2>
          <p style={{ fontSize: 14, color: "#d5d9e4" }}>
            Start with a free JKTL template. No credit card required.
          </p>
        </div>
        <a
          href="https://business.jktl.com.ng/signup"
          target="_top"
          style={{
            background: "#c9a84c",
            color: "#060e2a",
            borderRadius: 30,
            padding: "12px 20px",
            fontWeight: 700,
          }}
        >
          Create my free website →
        </a>
      </div>
      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="jktl-trending-topics"
          onClick={() => setExpanded(!expanded)}
          style={{
            cursor: "pointer",
            fontWeight: 600,
            background: "transparent",
            color: "inherit",
            border: 0,
            padding: 0,
            textAlign: "left",
          }}
        >
          Trending searches in Nigeria · Google Trends
        </button>
        {expanded && (
          <div id="jktl-trending-topics">
            <p style={{ fontSize: 12, color: "#c4cad7", margin: "10px 0" }}>
              Search interest, not a JKTL ranking or verified news report.
              Refreshes about every 30 minutes when the source is available.
            </p>
            {state && <p role="status">{state}</p>}
            <ul
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                listStyle: "none",
                padding: 0,
              }}
            >
              {trends.map((t) => (
                <li
                  key={t.title}
                  style={{
                    border: "1px solid #39405a",
                    borderRadius: 12,
                    padding: 12,
                    flex: "1 1 220px",
                  }}
                >
                  <a
                    style={{ color: "#a9ceff", textDecoration: "underline" }}
                    href={t.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.title}
                  </a>
                  <p style={{ fontSize: 12, marginTop: 6, color: "#c4cad7" }}>
                    {t.volume ? `${t.volume} searches · ` : ""}
                    <time dateTime={t.publishedAt}>
                      {new Date(t.publishedAt).toLocaleDateString("en-NG")}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
            <a
              style={{ color: "#a9ceff", textDecoration: "underline" }}
              href="https://trends.google.com/trending?geo=NG"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Google Trends source ↗
            </a>
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, marginTop: 16 }}>
        Already have a website?{" "}
        <a
          style={{ color: "#a9ceff", textDecoration: "underline" }}
          href="https://jktl.com.ng/tools/seo-checker"
          target="_top"
        >
          Check its SEO for free
        </a>
        .
      </p>
    </section>
  );
}
