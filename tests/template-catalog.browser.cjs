const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const origin = process.env.PREVIEW_TEST_ORIGIN || "http://localhost:3101";
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    // Isolate catalog behavior from the independently tested PWA install guide.
    // This is the same reminder state created by its existing “Not now” action.
    await page.addInitScript(() =>
      localStorage.setItem(
        "jktl-pwa-remind-after",
        String(Date.now() + 86400000),
      ),
    );
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|hydrating|did not match/i.test(m.text())
      )
        errors.push(m.text());
    });
    assert.equal((await page.goto(origin + "/templates")).status(), 200);
    const gallery = page.locator("[data-template-catalog]"),
      cards = gallery.locator("article");
    await cards.first().waitFor();
    assert.equal(await cards.count(), 24);
    assert.deepEqual(
      await cards
        .locator("h2,h3")
        .allTextContents()
        .then((x) => x.slice(0, 3)),
      ["Law Firm", "Church & Ministry", "School & Academy"],
    );
    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const columns = await cards
        .first()
        .evaluate(
          (card) =>
            getComputedStyle(card.parentElement).gridTemplateColumns.split(" ")
              .length,
        );
      assert.equal(columns, 3);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const first = cards.first();
    await first.hover();
    assert.equal(
      await first
        .getByRole("link", { name: "Edit Law Firm template", exact: true })
        .isVisible(),
      true,
    );
    assert.match(
      await first
        .getByRole("link", { name: "Edit Law Firm template", exact: true })
        .getAttribute("href"),
      /https:\/\/business\.jktl\.com\.ng\/login\?template=law-firm$/,
    );
    assert.equal(
      await first
        .getByRole("link", { name: "Preview Law Firm template", exact: true })
        .getAttribute("href"),
      "/templates/law-firm",
    );
    await first
      .getByRole("button", { name: "Information about Law Firm", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Template information" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("dialog", { name: "Template information" })
        .isVisible(),
      false,
    );
    await gallery.evaluate(el => el.style.width = "720px");
    const bounds = await gallery.boundingBox();
    const searchBounds = await page.getByRole("searchbox", { name: "Search website templates" }).boundingBox();
    assert.ok(searchBounds.x + searchBounds.width <= bounds.x + bounds.width + 1);
    assert.equal(await cards.first().evaluate(card => getComputedStyle(card.parentElement).gridTemplateColumns.split(" ").length), 2);
    await gallery.evaluate(el => el.style.removeProperty("width"));
    await page
      .getByRole("combobox", { name: "Filter templates by industry" })
      .selectOption("Beauty & Wellness");
    assert.match(await gallery.getByRole("status").innerText(), /30 templates/);
    assert.equal(await cards.count(), 24);
    const firstThree = await cards
      .locator("h2,h3")
      .allTextContents()
      .then((x) => x.slice(0, 3));
    assert.ok(firstThree.includes("Hair Salon & Beauty"));
    assert.equal(new Set(firstThree).size, 3);
    await page
      .getByRole("button", { name: "Hair Salon & Beauty", exact: true })
      .click();
    assert.equal(await cards.count(), 10);
    await page
      .getByRole("combobox", { name: "Filter template type" })
      .selectOption("landing");
    assert.ok((await cards.count()) > 0 && (await cards.count()) < 10);
    assert.ok(
      (await cards.allTextContents()).every((text) =>
        text.includes("Landing page"),
      ),
    );
    await page
      .getByRole("button", { name: "All Templates", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Filter template type" })
      .selectOption("blank");
    assert.equal(await cards.count(), 2);
    await page
      .getByRole("button", { name: "All Templates", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search website templates" })
      .fill("not-a-real-template-xyz");
    assert.equal(await cards.count(), 0);
    await gallery
      .getByRole("heading", { name: "No templates found", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    assert.equal(await cards.count(), 24);
    await page.getByRole("button", { name: /Show more templates/ }).click();
    assert.equal(await cards.count(), 48);
    await page
      .getByRole("searchbox", { name: "Search website templates" })
      .fill("hair salon");
    assert.equal(await cards.count(), 10);
    await page
      .getByRole("button", { name: "All Templates", exact: true })
      .click();
    await page.evaluate(() => scrollTo(0, 650));
    const sticky = await page
      .getByRole("group", { name: "Template filters", exact: true })
      .boundingBox();
    assert.ok(sticky.y >= 0 && sticky.y <= 70);
    for (const width of [320, 390, 412]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/templates");
      await cards.first().waitFor();
      assert.equal(
        await cards
          .first()
          .getByRole("link", { name: "Edit Law Firm template", exact: true })
          .isVisible(),
        true,
        "touch actions need no hover",
      );
      const industry = await page
          .getByRole("combobox", { name: "Filter templates by industry" })
          .boundingBox(),
        reset = await page
          .getByRole("button", { name: "All Templates", exact: true })
          .boundingBox();
      assert.ok(
        industry.x + industry.width <= reset.x + 1,
        "mobile filter must not overlap reset",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no page horizontal overflow",
      );
      await cards
        .first()
        .getByRole("button", {
          name: "Information about Law Firm",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog", { name: "Template information" })
        .waitFor();
      await page
        .getByRole("button", { name: "Close template details", exact: true })
        .click();
    }
    await cards
      .first()
      .getByRole("link", { name: "Preview Law Firm template", exact: true })
      .click();
    await page.waitForURL(origin + "/templates/law-firm");
    await page.frameLocator("iframe").locator("h1").first().waitFor();
    assert.ok(
      (
        await page
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=law-firm"),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        origin +
        ": 3-column desktop gallery, source variety, public preview/edit paths, keyboard/touch info, industry/niche/type/search/reset/blank filters, pagination, sticky toolbar and 320/390/412px layouts without overlap or hydration errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
