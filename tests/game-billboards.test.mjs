import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as model from "../src/lib/game-world/model.ts";
const now = Date.parse("2026-11-07T18:00:00Z"),
  observedAt = new Date(now).toISOString();
function event(state = "in", completed = false) {
  return {
    id: "1",
    date: "2026-11-07T17:30:00Z",
    status: {
      type: {
        state,
        completed,
        shortDetail: state === "post" ? "Postponed" : "25′",
      },
    },
    links: [{ href: "https://www.espn.com/soccer/match/_/gameId/1" }],
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: { shortDisplayName: "Home" }, score: "1" },
          { homeAway: "away", team: { shortDisplayName: "Away" }, score: "0" },
        ],
      },
    ],
  };
}
const feed = (matches) => ({
  date: "2026-11-07",
  matches,
  matchesAvailable: true,
  coverage: ["Premier League"],
  headlines: [],
  trends: [],
  checkedAt: observedAt,
});
test("live, fixtures, results, postponed games and stale data stay distinct", () => {
  const [m] = model.parseMatches(
    { events: [event()] },
    "Premier League",
    observedAt,
    "2026-11-07",
  );
  assert.match(model.matchLabel(m, now), /^LIVE/);
  assert.equal(model.boardItems(feed([m]), now)[1].title, "Home 1 – 0 Away");
  assert.equal(model.matchLabel(m, now + 121000), "Updates delayed");
  assert.equal(
    model.boardItems(feed([m]), now + 121000).filter((i) => i.kind === "match")
      .length,
    0,
  );
  const [pre] = model.parseMatches(
    { events: [event("pre")] },
    "Premier League",
    observedAt,
    "2026-11-07",
  );
  assert.match(model.matchLabel(pre, now), /WAT$/);
  assert.equal(model.boardItems(feed([pre]), now)[1].title, "Home v Away");
  const [postponed] = model.parseMatches(
    { events: [event("post")] },
    "Premier League",
    observedAt,
    "2026-11-07",
  );
  assert.equal(model.matchLabel(postponed, now), "Postponed");
  assert.equal(
    model.boardItems(feed([postponed]), now)[1].title,
    "Home v Away",
  );
  const [finished] = model.parseMatches(
    { events: [event("post", true)] },
    "Premier League",
    observedAt,
    "2026-11-07",
  );
  assert.equal(model.matchLabel(finished, now), "FT");
  assert.equal(
    model.parseMatches(
      { events: [event()] },
      "Premier League",
      observedAt,
      "2026-11-08",
    ).length,
    0,
  );
  assert.equal(model.watDay(new Date("2026-11-07T23:30:00Z")), "2026-11-08");
  assert.throws(() =>
    model.parseMatches({}, "league", observedAt, "2026-11-07"),
  );
  assert.equal(
    model.boardItems(null, now)[0].title,
    "Got 5 minutes? Start your free website.",
  );
});
test("news is dated, recent, attributed and restricted to publisher HTTPS links", () => {
  const item = (url, date) =>
    `<item><title><![CDATA[<b>Test headline</b>]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
  const news = model.parseHeadlines(
    "<rss>" +
      item("https://www.bbc.com/news/articles/test", observedAt) +
      item("javascript:alert(1)", observedAt) +
      item("https://bbc.com/news/old", "2026-01-01") +
      "</rss>",
    now,
  );
  assert.equal(news.length, 1);
  assert.equal(news[0].title, "Test headline");
  assert.equal(news[0].source, "BBC News");
  assert.throws(() => model.parseHeadlines("<!DOCTYPE x>"));
  assert.equal(
    model.sourceUrl("https://bbc.com.evil.example/story", ["bbc.com"]),
    "",
  );
});
test("provider failures stay partial, news survives and fresh fetches are coalesced", async () => {
  const require = createRequire(import.meta.url),
    m = { exports: {} },
    old = global.fetch;
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    if (String(url).includes("espn"))
      return new Response(JSON.stringify({ events: [] }), {
        headers: { date: new Date().toUTCString() },
      });
    return new Response("<rss/>");
  };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(readFileSync("src/lib/game-world/feed.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) =>
      n === "./model"
        ? model
        : n === "@/lib/google-trends"
          ? { nigeriaTrends: async () => [] }
          : require(n),
    m,
    m.exports,
  );
  try {
    const [a, b] = await Promise.all([
      m.exports.gameWorldFeed(),
      m.exports.gameWorldFeed(),
    ]);
    assert.equal(a, b);
    assert.equal(calls, 4);
    assert.equal(a.matchesAvailable, true);
    assert.equal(a.matches.length, 0);
    await m.exports.gameWorldFeed();
    assert.equal(calls, 4);
  } finally {
    global.fetch = old;
  }
});
