const { chromium } = require("playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setContent(
        fs.readFileSync("/tmp/jktl-lifecycle-journey.html", "utf8"),
      );
      await page
        .getByRole("heading", { name: "Account journey & follow-ups" })
        .waitFor();
      assert.ok(
        await page
          .getByRole("checkbox", {
            name: "Automatic account follow-up emails",
            exact: true,
          })
          .isChecked(),
      );
      assert.equal(
        await page.locator('input[name="first_days"]').inputValue(),
        "3",
      );
      assert.equal(
        await page.locator('input[name="second_days"]').inputValue(),
        "7",
      );
      assert.equal(
        await page.locator('input[name="human_days"]').inputValue(),
        "14",
      );
      await page.getByText("Preview next follow-up copy").first().click();
      await page
        .getByText(/You can start with a free JKTL website template/)
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `/tmp/jktl-lifecycle-journey-${width}.png`,
        fullPage: true,
      });
      await page.setContent(
        fs.readFileSync("/tmp/jktl-lifecycle-followups.html", "utf8"),
      );
      await page
        .getByRole("heading", { name: "Customer follow-ups" })
        .waitFor();
      assert.ok(
        (await page
          .getByRole("button", { name: "Save follow-up", exact: true })
          .count()) > 0,
      );
      await page
        .locator('select[name="status"]')
        .first()
        .selectOption("IN_PROGRESS");
      await page
        .locator('textarea[name="notes"]')
        .first()
        .fill("Helping this business complete its website.");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `/tmp/jktl-lifecycle-followups-${width}.png`,
        fullPage: true,
      });
      await page.close();
      console.log(
        "PASS rendered team settings, message preview and follow-up controls at " +
          width +
          "px; no live submissions.",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
