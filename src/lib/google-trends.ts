export type Trend = {
  title: string;
  publishedAt: string;
  searchUrl: string;
  volume: string;
};
function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const c =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, k) =>
        (
          ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }) as Record<
            string,
            string
          >
        )[k] || "",
    )
    .replace(/<[^>]*>/g, "")
    .trim();
}
export function parseTrends(xml: string): Trend[] {
  if (xml.length > 512000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("Invalid trend feed");
  const seen = new Set<string>(),
    result: Trend[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const field = (tag: string) =>
      decode(
        new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">").exec(
          item[1],
        )?.[1] || "",
      );
    const title = field("title").slice(0, 120),
      publishedAt = field("pubDate"),
      date = new Date(publishedAt);
    if (!title || seen.has(title) || !Number.isFinite(date.getTime())) continue;
    seen.add(title);
    result.push({
      title,
      publishedAt: date.toISOString(),
      volume: field("ht:approx_traffic").slice(0, 25),
      searchUrl:
        "https://trends.google.com/trends/explore?geo=NG&q=" +
        encodeURIComponent(title),
    });
    if (result.length === 6) break;
  }
  return result;
}
export async function nigeriaTrends() {
  const response = await fetch(
    "https://trends.google.com/trending/rss?geo=NG",
    { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) },
  );
  if (!response.ok) throw Error("Trends temporarily unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty trend feed");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 512000) throw Error("Trend feed too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return parseTrends(Buffer.concat(chunks).toString("utf8"));
}
