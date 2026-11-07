"use client";
import { useState } from "react";
import { GameUpdates } from "./GameUpdates";
export function GameGrowth() {
  const [expanded, setExpanded] = useState(false);
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
          Matches, news & trending searches
        </button>
        {expanded && (
          <div id="jktl-trending-topics">
            <GameUpdates />
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
