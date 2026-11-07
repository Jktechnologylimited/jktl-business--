"use client";
import { useWorldFeed } from "./useWorldFeed";
import { boardItems, matchLabel, WEBSITE_BOARD } from "@/lib/game-world/model";
export function GameUpdates() {
  const { feed, now } = useWorldFeed(),
    items = boardItems(feed, now);
  return (
    <section
      aria-label="Match and news updates"
      style={{
        fontSize: 12,
        lineHeight: 1.6,
        padding: "12px 0",
        overflowWrap: "anywhere",
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>Today’s football · WAT</h3>
      <p style={{ opacity: 0.75 }}>
        ESPN updates may be delayed. Coverage:{" "}
        {feed?.coverage.join(", ") ||
          "Premier League, La Liga, Champions League"}
        .
      </p>
      {!feed ? (
        <p>Loading match updates…</p>
      ) : !feed.matchesAvailable ? (
        <p>Match updates temporarily unavailable.</p>
      ) : !feed.matches.length ? (
        <p>No matches listed today in the supported competitions.</p>
      ) : (
        <ul style={{ paddingLeft: 16 }}>
          {feed.matches.slice(0, 6).map((m) => (
            <li key={m.id}>
              <a
                style={{ color: "inherit", textDecoration: "underline" }}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {items.find((i) => i.kind === "match" && i.url === m.url)
                  ?.title || `${m.home} v ${m.away}`}
              </a>{" "}
              · {matchLabel(m, now)}
            </li>
          ))}
        </ul>
      )}
      <h3 style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>News</h3>
      {items
        .filter((i) => i.kind === "news")
        .slice(0, 4)
        .map((i) => (
          <p key={i.url}>
            <a
              style={{ color: "inherit", textDecoration: "underline" }}
              href={i.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {i.title}
            </a>
            <small style={{ display: "block", opacity: 0.7 }}>
              {i.label} · {i.detail}
            </small>
          </p>
        ))}
      <p style={{ marginTop: 12 }}>
        <a
          style={{
            color: "inherit",
            fontWeight: 700,
            textDecoration: "underline",
          }}
          href={WEBSITE_BOARD.url}
          target="_top"
        >
          {WEBSITE_BOARD.title} →
        </a>
      </p>
    </section>
  );
}
