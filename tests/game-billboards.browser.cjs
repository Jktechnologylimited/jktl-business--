const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.BASE_URL || "http://localhost:3200";
function fixture() {
  const now = new Date().toISOString();
  return {
    date: now.slice(0, 10),
    checkedAt: now,
    matchesAvailable: true,
    coverage: ["Premier League"],
    matches: [
      {
        id: "fixture",
        home: "Home FC",
        away: "Away FC",
        homeScore: "1",
        awayScore: "0",
        state: "in",
        completed: false,
        detail: "12′",
        startsAt: now,
        observedAt: now,
        league: "Premier League",
        url: "https://www.espn.com/soccer/scoreboard",
      },
    ],
    headlines: [
      {
        title: "Test headline for billboard verification",
        source: "BBC News",
        publishedAt: now,
        url: "https://www.bbc.com/news",
      },
    ],
    trends: [],
  };
}
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  try {
    for (const width of [1440, 390]) {
      const context = await b.newContext({ viewport: { width, height: 900 } }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await context.addInitScript(() => {
        window.__boardPaint = [];
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          window.__boardPaint.push(args[0]);
          return original.apply(this, args);
        };
        localStorage.setItem(
          "jktl-tycoon-guest-v1",
          JSON.stringify({
            version: 1,
            week: 5,
            cash: 500000,
            city: "Lagos",
            plots: Array.from({ length: 12 }, (_, i) =>
              i < 2 ? { kind: i === 0 ? "suya" : "salon", level: 1 } : null,
            ),
            digital: false,
            solar: false,
            debt: 0,
            log: [],
          }),
        );
      });
      await page.route("**/api/game-world-feed", (r) =>
        r.fulfill({ json: fixture() }),
      );
      await page.route("**/api/tycoon", (r) =>
        r.fulfill({ json: { signedIn: false, revision: 0, document: null } }),
      );
      await page.goto(base + "/play/tycoon");
      await page
        .locator("canvas[data-webgl-ready]")
        .waitFor({ timeout: 60000 });
      await page.waitForFunction(
        () =>
          window.__boardPaint.includes("JKTL BUSINESS") &&
          window.__boardPaint.some((t) => t.startsWith("LIVE")),
      );
      await page.screenshot({
        path: "/tmp/jktl-city-billboards-" + width + ".png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Games", exact: false })
        .first()
        .click();
      await page
        .getByRole("heading", { name: "Today’s football · WAT" })
        .waitFor();
      await page.getByRole("link", { name: "Home FC 1 – 0 Away FC" }).waitFor();
      assert.equal(context.pages().length, 1);
      await page.goto(base + "/play/run");
      await page
        .locator("canvas[data-webgl-ready]")
        .waitFor({ timeout: 60000 });
      await page.waitForFunction(
        () =>
          window.__boardPaint.includes("JKTL BUSINESS") &&
          window.__boardPaint.some((t) => t.startsWith("LIVE")),
      );
      await page
        .getByRole("button", { name: "Start running", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector("[data-run-score]")
              .textContent.replace(/,/g, ""),
          ) > 0,
      );
      await page.screenshot({
        path: "/tmp/jktl-runner-billboards-" + width + ".png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS 3D billboard textures, sourced matches menu and playable runner at " +
          width +
          "px",
      );
      await context.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
