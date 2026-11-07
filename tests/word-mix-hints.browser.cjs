const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  fs = require("node:fs");
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
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 320, height: 740 },
    ]) {
      const page = await browser.newPage({
          viewport,
          hasTouch: viewport.width < 600,
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/public/features", (r) =>
        r.fulfill({ json: { features: [] } }),
      );
      await page.goto(
        (process.env.ARCADE_TEST_ORIGIN || "http://localhost:3182") +
          "/play/word-mix",
      );
      await page.getByRole("button", { name: /Mix it up/ }).click();
      const round = model.exports.mixRounds(2026)[0];
      const wrong = round.letters.findIndex(
        (letter) => letter !== round.word[0],
      );
      await page
        .getByRole("button", { name: new RegExp(`tile ${wrong + 1}$`) })
        .click();
      await page.getByRole("button", { name: /Hint/ }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "placed in position 1" })
        .waitFor();
      assert.equal(
        await page.locator('[data-answer-slot="0"]').textContent(),
        round.word[0],
      );
      assert.equal(
        await page
          .locator('[data-answer-slot="0"]')
          .getAttribute("data-hinted"),
        "true",
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Undo", exact: true })
          .isDisabled(),
      );
      const tile = round.letters.findIndex(
        (letter, i) =>
          letter === round.word[1] &&
          i !== round.letters.indexOf(round.word[0]),
      );
      await page
        .getByRole("button", { name: new RegExp(`tile ${tile + 1}$`) })
        .click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(
        await page.locator('[data-answer-slot="0"]').textContent(),
        round.word[0],
      );
      assert.equal(
        await page.locator('[data-answer-slot="1"]').textContent(),
        "",
      );
      await page.getByRole("button", { name: /Hint/ }).click();
      assert.equal(
        await page.locator('[data-answer-slot="1"]').textContent(),
        round.word[1],
      );
      await page.getByRole("button", { name: "Pause game" }).click();
      await page.getByRole("button", { name: /Keep mixing/ }).click();
      for (let position = 2; position < round.word.length; position++) {
        await page.getByLabel("Word mixing board", { exact: true }).focus();
        await page.keyboard.type(round.word[position]);
      }
      await page.keyboard.press("Backspace");
      assert.equal(
        await page
          .locator('[data-answer-slot="1"]')
          .getAttribute("data-hinted"),
        "true",
      );
      await page.keyboard.type(round.word.at(-1));
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: "That’s the word." }).waitFor();
      assert.ok(
        Number(await page.locator("[data-arcade-score]").textContent()) <= 330,
      );
      await page.getByRole("button", { name: /Next clue/ }).click();
      assert.equal(await page.locator("[data-hinted]").count(), 0);
      assert.equal(
        await page
          .locator("[data-answer-slot]")
          .filter({ hasText: /[A-Z]/ })
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        "PASS placed hints, wrong-letter repair, locked undo/backspace, pause, scoring and round reset at " +
          viewport.width,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
