import test from "node:test";
import assert from "node:assert/strict";
import { parseTrends } from "../src/lib/google-trends.ts";
const item = (title) =>
  `<item><title>${title}</title><pubDate>Sat, 7 Nov 2026 09:00:00 -0800</pubDate><ht:approx_traffic>500+</ht:approx_traffic></item>`;
test("official RSS parser uses real bounded topics, deduplicates and only links to Google Trends", () => {
  const t = parseTrends(
    "<rss>" +
      item("Nigeria &amp; football") +
      item("Nigeria &amp; football") +
      item("<![CDATA[<script>bad</script>topic]]>") +
      "</rss>",
  );
  assert.equal(t.length, 2);
  assert.equal(t[0].title, "Nigeria & football");
  assert.equal(t[0].volume, "500+");
  assert.equal(new URL(t[0].searchUrl).hostname, "trends.google.com");
  assert.ok(!t[1].title.includes("<"));
  assert.equal(parseTrends("<rss/>").length, 0);
  assert.throws(() => parseTrends("<!DOCTYPE x []>"));
  assert.throws(() => parseTrends("x".repeat(512001)));
});
