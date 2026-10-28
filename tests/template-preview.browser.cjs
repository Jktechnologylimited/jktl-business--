// Run against a local app: PREVIEW_TEST_ORIGIN=http://localhost:3101 node tests/template-preview.browser.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const origin = process.env.PREVIEW_TEST_ORIGIN || "http://localhost:3000";
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|hydrating|did not match|server rendered/i.test(message.text())
    )
      errors.push(message.text());
  });
  // Keep rendering deterministic when external image hosts are unavailable.
  await page.route(/https:\/\/images\.(unsplash|pexels)\.com\//, (route) =>
    route.abort(),
  );
  try {
    for (const [width, height] of [
      [320, 640],
      [375, 812],
      [390, 844],
      [412, 915],
      [667, 375],
      [767, 900],
    ]) {
      await page.setViewportSize({ width, height });
      const response = await page.goto(origin + "/templates/law-firm");
      assert.equal(response.status(), 200);
      await page.frameLocator("iframe").locator("h1").first().waitFor();
      await page.waitForFunction(() => {
        const f = document.querySelector("iframe");
        return f && f.clientHeight >= f.contentDocument.body.scrollHeight - 2;
      });
      assert.equal(
        await page
          .getByRole("group", { name: "Preview device", exact: true })
          .isVisible(),
        false,
      );
      const dimensions = await page.locator("iframe").evaluate((f) => ({
        width: f.contentWindow.innerWidth,
        border: getComputedStyle(f).borderLeftWidth,
        parent: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      }));
      assert.equal(dimensions.width, width, "actual mobile iframe viewport");
      assert.equal(dimensions.border, "0px");
      assert.ok(dimensions.parent <= width, "no horizontal desktop overflow");
      assert.ok(dimensions.pageHeight > height, "outer page naturally scrolls");
      await page.evaluate(() => window.scrollTo(0, 600));
      const box = await page
        .getByRole("link", { name: "Select Template" })
        .boundingBox();
      assert.ok(
        box.y >= 0 && box.y < 80,
        "selection remains accessible while scrolling",
      );
      assert.match(
        await page
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href"),
        /https:\/\/business\.jktl\.com\.ng\/login\?template=law-firm$/,
      );
    }
    for (const width of [768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + "/templates/law-firm");
      await page.frameLocator("iframe").locator("h1").first().waitFor();
      await page
        .getByRole("button", { name: "Desktop preview", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Desktop preview", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.innerWidth),
        width,
      );
      await page
        .locator("iframe")
        .evaluate((f) => (f.contentWindow.__previewMarker = "preserved"));
      await page
        .getByRole("button", { name: "Mobile preview", exact: true })
        .click();
      assert.ok(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.innerWidth <= 390),
      );
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.__previewMarker),
        "preserved",
      );
      assert.equal(new URL(page.url()).pathname, "/templates/law-firm");
      await page.setViewportSize({ width: 375, height: 812 });
      assert.equal(
        await page
          .getByRole("group", { name: "Preview device", exact: true })
          .isVisible(),
        false,
      );
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.innerWidth),
        375,
      );
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Desktop preview"]')
            .getAttribute("aria-pressed") === "true",
      );
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.innerWidth),
        width,
      );
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.__previewMarker),
        "preserved",
      );
    }
    for (const id of ["school", "blank-website", "law-firm-launch"]) {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        (await page.goto(origin + "/templates/" + id)).status(),
        200,
      );
      await page.frameLocator("iframe").locator("h1").first().waitFor();
      assert.equal(
        await page
          .locator("iframe")
          .evaluate((f) => f.contentWindow.innerWidth),
        390,
      );
      assert.ok(
        (
          await page
            .getByRole("link", { name: "Select Template" })
            .getAttribute("href")
        ).endsWith("?template=" + id),
      );
    }
    await page.getByRole("link", { name: "All templates" }).click();
    await page.waitForURL(origin + "/templates");
    assert.deepEqual(errors, [], "no browser/hydration exceptions");
    console.log(
      "PASS " +
        origin +
        ": 6 mobile sizes, 3 desktop sizes, toggling/resizing without reload, 4 templates, sticky actions, scrolling, back and selection links.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
