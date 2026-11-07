export type MatchUpdate = {
  id: string;
  home: string;
  away: string;
  homeScore: string | null;
  awayScore: string | null;
  state: "pre" | "in" | "post";
  completed: boolean;
  detail: string;
  startsAt: string;
  observedAt: string;
  league: string;
  url: string;
};
export type Headline = {
  title: string;
  publishedAt: string;
  url: string;
  source: string;
};
export type WorldFeed = {
  date: string;
  matches: MatchUpdate[];
  matchesAvailable: boolean;
  coverage: string[];
  headlines: Headline[];
  checkedAt: string;
};
export type BoardItem = {
  kind: "website" | "match" | "news";
  title: string;
  label: string;
  detail: string;
  url: string;
};
export const WEBSITE_BOARD: BoardItem = {
  kind: "website",
  title: "Got 5 minutes? Start your free website.",
  label: "JKTL BUSINESS",
  detail: "Choose a free template · No credit card",
  url: "https://jktl.com.ng/templates",
};
export const watDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max = 100) =>
  typeof v === "string" ? v.slice(0, max) : "";
export function sourceUrl(raw: unknown, hosts: string[]) {
  try {
    const u = new URL(String(raw));
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function parseMatches(
  raw: unknown,
  league: string,
  observedAt: string,
  day: string,
): MatchUpdate[] {
  if (!Array.isArray(obj(raw).events))
    throw Error("Unrecognized scoreboard response");
  const result: MatchUpdate[] = [];
  for (const item of arr(obj(raw).events)) {
    const e = obj(item),
      type = obj(obj(e.status).type),
      competition = obj(arr(e.competitions)[0]);
    const competitors = arr(competition.competitors).map(obj),
      home = competitors.find((c) => c.homeAway === "home"),
      away = competitors.find((c) => c.homeAway === "away");
    const date = new Date(text(e.date)),
      state = type.state;
    if (
      !home ||
      !away ||
      !["pre", "in", "post"].includes(String(state)) ||
      !Number.isFinite(date.getTime()) ||
      watDay(date) !== day
    )
      continue;
    const name = (c: Record<string, unknown>) =>
      text(obj(c.team).shortDisplayName || obj(c.team).displayName, 35);
    const score = (c: Record<string, unknown>) =>
      typeof c.score === "string" && /^\d{1,3}$/.test(c.score) ? c.score : null;
    const homeName = name(home),
      awayName = name(away);
    if (!homeName || !awayName) continue;
    const url =
      arr(e.links)
        .map((l) => sourceUrl(obj(l).href, ["espn.com", "espn.co.uk"]))
        .find(Boolean) || "https://www.espn.com/soccer/scoreboard";
    result.push({
      id: String(e.id).slice(0, 40),
      home: homeName,
      away: awayName,
      homeScore: score(home),
      awayScore: score(away),
      state: state as MatchUpdate["state"],
      completed: type.completed === true,
      detail: text(type.shortDetail || type.description, 50),
      startsAt: date.toISOString(),
      observedAt,
      league,
      url,
    });
  }
  return result;
}
export function matchLabel(m: MatchUpdate, now = Date.now()) {
  const age = now - new Date(m.observedAt).getTime();
  if (!Number.isFinite(age) || age > 120000 || age < -300000)
    return "Updates delayed";
  if (m.state === "in") return "LIVE" + (m.detail ? " · " + m.detail : "");
  if (m.state === "post")
    return m.completed ? "FT" : m.detail || "Match update";
  return (
    new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(m.startsAt)) + " WAT"
  );
}
export function boardItems(
  feed: WorldFeed | null,
  now = Date.now(),
): BoardItem[] {
  if (!feed) return [WEBSITE_BOARD];
  const result: BoardItem[] = [WEBSITE_BOARD];
  for (const m of feed.matches) {
    if (watDay(new Date(m.startsAt)) !== watDay(new Date(now))) continue;
    const label = matchLabel(m, now);
    if (label === "Updates delayed") continue;
    const scores =
      (m.state === "in" || m.completed) &&
      m.homeScore !== null &&
      m.awayScore !== null
        ? `${m.homeScore} – ${m.awayScore}`
        : "v";
    result.push({
      kind: "match",
      title: `${m.home} ${scores} ${m.away}`,
      label,
      detail: `${m.league} · ESPN`,
      url: m.url,
    });
  }
  for (const h of feed.headlines) {
    const age = now - new Date(h.publishedAt).getTime();
    if (age < -300000 || age > 172800000 || !Number.isFinite(age)) continue;
    result.push({
      kind: "news",
      title: h.title,
      label: "NEWS · " + h.source,
      detail: new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(h.publishedAt)),
      url: h.url,
    });
  }
  return result;
}
export function parseHeadlines(xml: string, now = Date.now()): Headline[] {
  if (xml.length > 512000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("Invalid news feed");
  const clean = (s: string) =>
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  const result: Headline[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const field = (tag: string) =>
      clean(
        new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">").exec(
          item[1],
        )?.[1] || "",
      );
    const title = field("title").slice(0, 140),
      url = sourceUrl(field("link"), ["bbc.com", "bbc.co.uk"]),
      date = new Date(field("pubDate")),
      age = now - date.getTime();
    if (
      !title ||
      !url ||
      !Number.isFinite(age) ||
      age < -300000 ||
      age > 172800000
    )
      continue;
    result.push({
      title,
      url,
      publishedAt: date.toISOString(),
      source: "BBC News",
    });
    if (result.length === 4) break;
  }
  return result;
}
