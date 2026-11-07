import { nigeriaTrends } from "@/lib/google-trends";
import { parseMatches, parseHeadlines, watDay, type WorldFeed } from "./model";
const LEAGUES = [
  ["eng.1", "Premier League"],
  ["esp.1", "La Liga"],
  ["uefa.champions", "Champions League"],
] as const;
let cached: WorldFeed | null = null,
  inflight: Promise<WorldFeed> | null = null;
async function body(response: Response, max: number) {
  if (!response.ok) throw Error("Feed unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty feed");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw Error("Feed too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function collect(): Promise<WorldFeed> {
  const date = watDay(new Date()),
    today = date.replaceAll("-", "");
  const sports = Promise.allSettled(
    LEAGUES.map(async ([slug, name]) => {
      const r = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${today}`,
        { cache: "no-store", signal: AbortSignal.timeout(6000) },
      );
      const dateHeader = new Date(r.headers.get("date") || "").getTime(),
        age = Number(r.headers.get("age") || 0) * 1000;
      const observedAt = new Date(
        Math.min(
          Date.now(),
          Number.isFinite(dateHeader) ? dateHeader : Date.now(),
          Number.isFinite(age) ? Date.now() - age : Date.now(),
        ),
      ).toISOString();
      return parseMatches(
        JSON.parse(await body(r, 1500000)),
        name,
        observedAt,
        date,
      );
    }),
  );
  const [scores, news, trends] = await Promise.all([
    sports,
    fetch("https://feeds.bbci.co.uk/news/world/africa/rss.xml", {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => body(r, 512000))
      .then((x) => parseHeadlines(x))
      .catch(() => []),
    nigeriaTrends()
      .then((items) =>
        items.map((i) => ({
          title: i.title,
          url: i.searchUrl,
          publishedAt: i.publishedAt,
          source: "Google Trends",
        })),
      )
      .catch(() => []),
  ]);
  const matches = scores.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  matches.sort(
    (a, b) =>
      ({ in: 0, pre: 1, post: 2 })[a.state] -
        { in: 0, pre: 1, post: 2 }[b.state] ||
      a.startsAt.localeCompare(b.startsAt),
  );
  return {
    date,
    matches: matches.slice(0, 24),
    matchesAvailable: scores.some((s) => s.status === "fulfilled"),
    coverage: LEAGUES.filter((_, i) => scores[i].status === "fulfilled").map(
      (l) => l[1],
    ),
    headlines: news,
    trends,
    checkedAt: new Date().toISOString(),
  };
}
export async function gameWorldFeed() {
  if (
    cached &&
    cached.date === watDay(new Date()) &&
    Date.now() - new Date(cached.checkedAt).getTime() < 60000
  )
    return cached;
  if (inflight) return inflight;
  inflight = collect()
    .then((data) => {
      cached = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
