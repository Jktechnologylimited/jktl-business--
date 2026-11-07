const { chromium } = require("playwright");
const ts = require("typescript"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const model = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(fs.readFileSync("src/lib/arcade-model.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(model, model.exports);
const origin = process.env.ARCADE_TEST_ORIGIN || "http://localhost:3180";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    await page.route("**/api/public/features", (route) =>
      route.fulfill({ json: { features: [] } }),
    );
    async function go(path) {
      const r = await page.goto(origin + path);
      assert.equal(r.status(), 200);
      await page.waitForLoadState("networkidle");
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
    await go("/play/market-match");
    await page.getByRole("button", { name: /Open the market/ }).click();
    const deck = model.exports.memoryDeck(41),
      ids = [...new Set(deck.map((c) => c.id))];
    // A wrong pair returns face down and resets the streak.
    const wrong = deck.findIndex((c) => c.id !== deck[0].id);
    await page.locator('[data-card="0"]').tap();
    await page.locator(`[data-card="${wrong}"]`).tap();
    await page.waitForTimeout(850);
    assert.equal(await page.locator("[data-card][data-open]").count(), 0);
    for (const id of ids) {
      const pair = deck.flatMap((c, i) => (c.id === id ? [i] : []));
      await page.locator(`[data-card="${pair[0]}"]`).tap();
      await page.locator(`[data-card="${pair[1]}"]`).tap();
      await page.waitForTimeout(420);
    }
    await page.getByRole("heading", { name: "A beautiful memory." }).waitFor();
    assert.ok(
      Number(await page.locator("[data-arcade-score]").textContent()) > 1000,
    );
    assert.ok(
      Number(
        await page.evaluate(() =>
          localStorage.getItem("jktl-arcade-market-match"),
        ),
      ) > 1000,
    );
    await page.getByRole("button", { name: /Play another market/ }).click();
    assert.equal(await page.locator("[data-card][data-open]").count(), 0);
    console.log(
      "PASS memory mismatch, eight pairs, completion, fresh round and saved best",
    );
    await go("/play/word-mix");
    await page.getByRole("button", { name: /Mix it up/ }).click();
    await page.getByRole("button", { name: /Hint/ }).click();
    await page.getByRole("status").filter({ hasText: "Starts with" }).waitFor();
    await page.getByRole("button", { name: "Pause game" }).click();
    await page
      .getByRole("heading", { name: "Let that word simmer." })
      .waitFor();
    await page.getByRole("button", { name: /Keep mixing/ }).click();
    for (const [i, round] of model.exports.mixRounds(2026).entries()) {
      await page.getByLabel("Word mixing board", { exact: true }).focus();
      await page.keyboard.type(round.word);
      await page.keyboard.press("Enter");
      if (i < 4) {
        await page.getByRole("heading", { name: "That’s the word." }).waitFor();
        await page.getByRole("button", { name: /Next clue/ }).click();
      }
    }
    await page
      .getByRole("heading", { name: "Five words. Nicely done." })
      .waitFor();
    assert.ok(
      Number(
        await page.evaluate(() => localStorage.getItem("jktl-arcade-word-mix")),
      ) > 0,
    );
    await page.getByRole("button", { name: /A fresh mix/ }).click();
    console.log(
      "PASS anagrams with repeated letters, hints, pause, five rounds and saved best",
    );
    await go("/play/lagos-stack");
    await page.getByRole("button", { name: /Build the skyline/ }).click();
    await page.getByRole("button", { name: /Drop floor/ }).click();
    assert.ok(
      Number(await page.locator("[data-arcade-score]").textContent()) > 0,
    );
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("heading", { name: "The city can wait." }).waitFor();
    await page.screenshot({ path: "/tmp/lagos-stack-mobile.png" });
    await page.getByRole("button", { name: /Keep building/ }).click();
    await page.getByRole("img", { name: /Moving tower floor/ }).focus();
    await page.keyboard.press("Space");
    console.log("PASS moving tower, drop, score, keyboard and pause");
    await go("/play/market-slice");
    await page.getByRole("button", { name: /Start slicing/ }).click();
    await page
      .getByRole("button", { name: /^Slice / })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: /^Slice / })
      .first()
      .tap();
    assert.ok(
      Number(await page.locator("[data-arcade-score]").textContent()) >= 10,
    );
    await page.getByRole("button", { name: "Pause game" }).click();
    await page
      .getByRole("heading", { name: "Keep your fruit fresh." })
      .waitFor();
    const paused = await page.locator("[data-arcade-score]").textContent();
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("[data-arcade-score]").textContent(),
      paused,
    );
    await page.screenshot({ path: "/tmp/market-slice-mobile.png" });
    await page.getByRole("button", { name: /Keep slicing/ }).click();
    await page
      .getByRole("heading", { name: /Time for a fresh batch/ })
      .waitFor({ timeout: 20000 });
    assert.ok(
      Number(
        await page.evaluate(() =>
          localStorage.getItem("jktl-arcade-market-slice"),
        ),
      ) > 0,
    );
    console.log(
      "PASS fruit tap, scoring, pause, missed-fruit game over and saved best",
    );
    await go("/play");
    await page.getByLabel("Search games").fill("market");
    assert.equal(
      await page
        .getByRole("link", { name: "Market Slice", exact: true })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "Save Market Slice to favourites" })
      .click();
    await page.getByRole("button", { name: "Favourites", exact: true }).click();
    assert.equal(
      await page
        .getByRole("link", { name: "Market Slice", exact: true })
        .count(),
      1,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Market Match", exact: true })
        .count(),
      0,
    );
    await page.getByRole("link", { name: "Market Slice", exact: true }).click();
    assert.equal(await page.locator("iframe").count(), 1);
    await page
      .frameLocator("iframe")
      .getByRole("button", { name: /Start slicing/ })
      .waitFor();
    await page.getByRole("button", { name: "All games", exact: true }).click();
    assert.equal(await page.locator("iframe").count(), 0);
    await page.getByLabel("Search games").fill("");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Pick for me" }).click();
    assert.equal(await page.locator("iframe").count(), 1);
    await page.goBack();
    await page
      .getByRole("heading", { name: "Your next little obsession." })
      .waitFor();
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await page
        .getByRole("button", { name: "Remove Market Slice from favourites" })
        .first()
        .getAttribute("aria-pressed"),
      "true",
    );
    console.log(
      "PASS catalogue search, favourites persistence, random pick, recent plays, browser back and one iframe",
    );
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const slug of [
        "market-match",
        "word-mix",
        "market-slice",
        "lagos-stack",
      ]) {
        await go("/play/" + slug);
        const cta = page
          .getByRole("region", { name: "Game menu" })
          .getByRole("button");
        await cta.scrollIntoViewIfNeeded();
        assert.ok(await cta.isVisible());
        const rect = await cta.boundingBox();
        assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height);
        await cta.click();
        await page.getByRole("button", { name: "Pause game" }).click();
        await page.getByRole("button", { name: "Games", exact: true }).click();
        await page
          .getByRole("navigation", { name: "Switch game" })
          .getByRole("link", { name: /Naija Word Mix/ })
          .waitFor();
        await page.keyboard.press("Escape");
      }
      await go("/play");
      await page.screenshot({
        path: `/tmp/jktl-games-${viewport.width}.png`,
        fullPage: true,
      });
      console.log(
        "PASS four games + catalogue controls at " +
          viewport.width +
          "x" +
          viewport.height,
      );
    }
    if (process.env.MAIN_ARCADE_TEST_ORIGIN) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(process.env.MAIN_ARCADE_TEST_ORIGIN + "/games");
      await page.waitForLoadState("networkidle");
      assert.equal(
        await page
          .getByRole("combobox", { name: "Choose a game" })
          .locator("option")
          .count(),
        9,
      );
      await page
        .getByRole("combobox", { name: "Choose a game" })
        .selectOption("market-match");
      await page
        .frameLocator("iframe")
        .getByRole("button", { name: /Open the market/ })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      console.log("PASS Main nine-game picker embeds new game on mobile");
    }
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
