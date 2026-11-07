const { chromium } = require("playwright"),
  ts = require("typescript"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const mod = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(fs.readFileSync("src/lib/arcade-model.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(mod, mod.exports);
const { mixRounds, MIX_WINS_KEY } = mod.exports,
  origin = process.env.ARCADE_TEST_ORIGIN || "http://localhost:3182";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 320, height: 740 },
        hasTouch: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/public/features", (route) =>
      route.fulfill({ json: { features: [] } }),
    );
    await page.addInitScript(() => {
      Date.now = () => 20261107;
    });
    async function load(wins) {
      await page.goto(origin + "/play/word-mix");
      await page.evaluate(
        ([key, value]) => localStorage.setItem(key, value),
        [MIX_WINS_KEY, String(wins)],
      );
      await page.reload();
      await page.getByRole("button", { name: /Mix it up/ }).waitFor();
      await page.getByRole("button", { name: /Mix it up/ }).click();
    }
    async function solve(seed, wins) {
      for (const [index, r] of mixRounds(seed, wins).entries()) {
        await page.getByLabel("Word mixing board", { exact: true }).focus();
        await page.keyboard.type(r.word);
        await page.keyboard.press("Enter");
        assert.equal(
          await page.evaluate(
            (key) => Number(localStorage.getItem(key)),
            MIX_WINS_KEY,
          ),
          wins + (index === 4 ? 1 : 0),
        );
        if (index < 4)
          await page.getByRole("button", { name: /Next clue/ }).click();
      }
      await page
        .getByRole("heading", { name: "Five words. Nicely done." })
        .waitFor();
    }
    await load(4);
    assert.ok((await page.locator("main").innerText()).includes("Starter"));
    await solve(2026, 4);
    await page.getByText(/Challenger unlocked!/).waitFor();
    await page.getByRole("button", { name: /A fresh mix/ }).click();
    assert.ok((await page.locator("main").innerText()).includes("Challenger"));
    await page.getByRole("button", { name: /Hint/ }).click();
    await page.getByRole("button", { name: /Hint/ }).click();
    assert.ok(await page.getByRole("button", { name: /Hint/ }).isDisabled());
    await page.getByRole("button", { name: "Pause game" }).click();
    await page.getByRole("button", { name: /Keep mixing/ }).click();
    assert.equal(
      await page.evaluate(
        (key) => Number(localStorage.getItem(key)),
        MIX_WINS_KEY,
      ),
      5,
    );
    await solve(20261107, 5);
    console.log(
      "PASS full-match win boundary, fifth-win unlock, tougher words and two-hint limit",
    );
    await load(9);
    await solve(2026, 9);
    await page.getByText(/Expert unlocked!/).waitFor();
    await page.reload();
    await page.getByRole("button", { name: /Mix it up/ }).click();
    assert.ok((await page.locator("main").innerText()).includes("Expert"));
    await page.getByRole("button", { name: /Hint/ }).click();
    assert.ok(await page.getByRole("button", { name: /Hint/ }).isDisabled());
    await solve(2026, 10);
    console.log(
      "PASS tenth-win unlock, expert puzzles, one-hint limit and persistence across reload",
    );
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.getByRole("button", { name: /A fresh mix/ }).click();
      await page
        .getByRole("button", { name: /Check word/ })
        .scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      for (const tile of await page
        .getByRole("button", { name: /^Letter / })
        .all()) {
        await tile.scrollIntoViewIfNeeded();
        assert.ok(await tile.isVisible());
      }
      await solve(20261107, viewport.width === 320 ? 11 : 12);
    }
    await load("invalid");
    assert.ok((await page.locator("main").innerText()).includes("Starter"));
    assert.deepEqual(errors, []);
    console.log(
      "PASS narrow/landscape long-word controls and invalid saved-progress fallback",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
