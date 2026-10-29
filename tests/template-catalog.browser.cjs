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
    await gallery.evaluate((el) => (el.style.width = "720px"));
    const bounds = await gallery.boundingBox();
    const searchBounds = await page
      .getByRole("searchbox", { name: "Search website templates" })
      .boundingBox();
    assert.ok(
      searchBounds.x + searchBounds.width <= bounds.x + bounds.width + 1,
    );
    assert.equal(
      await cards
        .first()
        .evaluate(
          (card) =>
            getComputedStyle(card.parentElement).gridTemplateColumns.split(" ")
              .length,
        ),
      2,
    );
    await gallery.evaluate((el) => el.style.removeProperty("width"));
    await page
      .getByRole("combobox", { name: "Filter templates by industry" })
      .selectOption("Beauty & Wellness");
    assert.match(await gallery.getByRole("status").innerText(), /34 templates/);
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
    assert.equal(await cards.count(), 11);
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
    const popupPromise = page.waitForEvent("popup");
    await cards
      .first()
      .getByRole("link", { name: "Preview Law Firm template", exact: true })
      .click();
    const preview = await popupPromise;
    await preview.waitForURL(origin + "/templates/law-firm");
    assert.equal(new URL(page.url()).pathname, "/templates");
    await preview.frameLocator("iframe").locator("h1").first().waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=law-firm"),
    );
    await preview.goto(origin + "/templates/beauty-atelier");
    await preview
      .frameLocator("iframe")
      .getByRole("heading", { name: "Where your individuality blooms." })
      .waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=beauty-atelier"),
    );
    for (const path of [
      "",
      "/about",
      "/services",
      "/services/skin-ritual",
      "/gallery",
      "/book",
      "/contact",
    ]) {
      const response = await page.request.get(
        origin + "/template-canvas/beauty-atelier" + path,
      );
      assert.equal(response.status(), 200, path);
      assert.ok((await response.text()).includes("Rouge Bloom Studio"));
    }
    for (const width of [1440, 390]) {
      await preview.setViewportSize({ width, height: 1000 });
      await preview.goto(origin + "/template-canvas/beauty-atelier");
      assert.equal(
        await preview.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const booking = preview
        .getByRole("link", { name: "Book your session", exact: true })
        .first();
      assert.equal(await booking.isVisible(), true);
      assert.equal(
        await booking.evaluate(
          (el) => getComputedStyle(el).color === "rgb(255, 255, 255)",
        ),
        false,
      );
    }
    await preview.goto(origin + "/templates/salon-luxe");
    await preview
      .frameLocator("iframe")
      .getByRole("heading", { name: "The art of beautifully you." })
      .waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=salon-luxe"),
    );
    for (const path of [
      "",
      "/about",
      "/services",
      "/services/signature-cut",
      "/gallery",
      "/book",
      "/contact",
    ]) {
      const response = await page.request.get(
        origin + "/template-canvas/salon-luxe" + path,
      );
      assert.equal(response.status(), 200, path);
      assert.ok((await response.text()).includes("Velour Hair Studio"));
    }
    for (const width of [1440, 320, 390]) {
      await preview.setViewportSize({ width, height: 1000 });
      for (const id of [
        "law-firm",
        "music-label",
        "blank-website",
        "hair-salon",
        "beauty-atelier",
        "salon-luxe",
        "barber-monochrome",
        "spa-solace",
        "law-firm-counsel",
      ]) {
        await preview.goto(origin + "/template-canvas/" + id);
        const signIn = preview.getByRole("link", {
          name: "Sign in to JKTL Business",
          exact: true,
        });
        await signIn.waitFor();
        assert.equal(
          await signIn.isVisible(),
          true,
          `${width}: ${id} visible login`,
        );
        assert.equal(
          await signIn.getAttribute("href"),
          "https://business.jktl.com.ng/login?template=" + id,
        );
        assert.equal(
          await preview.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${width}: ${id} overflow`,
        );
      }
    }
    await preview.goto(origin + "/templates/barber-monochrome");
    await preview
      .frameLocator("iframe")
      .getByRole("heading", { name: "Your cut. Your character." })
      .waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=barber-monochrome"),
    );
    for (const path of [
      "",
      "/about",
      "/services",
      "/services/traditional-shave",
      "/gallery",
      "/book",
      "/contact",
    ]) {
      const response = await page.request.get(
        origin + "/template-canvas/barber-monochrome" + path,
      );
      assert.equal(response.status(), 200, path);
      assert.ok((await response.text()).includes("Crown &amp; Blade"));
    }
    await preview.goto(origin + "/template-canvas/barber-monochrome");
    await preview.emulateMedia({ reducedMotion: "reduce" });
    const work = preview.getByRole("region", {
      name: "Barbershop work gallery",
    });
    await preview.getByRole("button", { name: "Next work images" }).click();
    await preview.waitForFunction(
      () => document.getElementById("barber-work").scrollLeft > 0,
    );
    await preview.getByRole("button", { name: "Previous work images" }).click();
    assert.equal(await work.evaluate((el) => el.scrollLeft), 0);
    await preview
      .getByRole("link", { name: "Request your appointment", exact: true })
      .first()
      .click();
    await preview.waitForURL(/\/book/);
    assert.equal(
      await preview
        .getByRole("button", { name: "Send appointment request" })
        .isVisible(),
      true,
    );
    await preview.goto(origin + "/templates/spa-solace");
    await preview
      .frameLocator("iframe")
      .getByRole("heading", { name: "Beauty, care and a softer pace." })
      .waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=spa-solace"),
    );
    for (const path of [
      "",
      "/about",
      "/services",
      "/services/facial-ritual",
      "/services/renew-package",
      "/gallery",
      "/book",
      "/contact",
      "/notes/preparing-for-your-first-spa-visit",
    ]) {
      const response = await page.request.get(
        origin + "/template-canvas/spa-solace" + path,
      );
      assert.equal(response.status(), 200, path);
      assert.ok((await response.text()).includes("Solace Beauty &amp; Spa"));
    }
    await preview.goto(origin + "/template-canvas/spa-solace");
    await preview
      .getByRole("heading", {
        name: "Preparing for your first spa visit",
        exact: true,
      })
      .getByRole("link")
      .click();
    await preview.waitForURL(/notes\/preparing-for-your-first-spa-visit/);
    assert.equal(
      await preview
        .getByRole("heading", {
          name: "Preparing for your first spa visit",
          exact: true,
        })
        .isVisible(),
      true,
    );
    await preview.goto(origin + "/template-canvas/spa-solace");
    const renew = preview.locator("article").filter({
      has: preview.getByRole("heading", { name: "Renew", exact: true }),
    });
    await renew
      .getByRole("link", { name: "Request an appointment", exact: true })
      .click();
    await preview.waitForURL(/book\?service=renew-package/);
    assert.equal(
      await preview.locator('select[name="service"]').inputValue(),
      "renew-package",
    );
    await preview.goto(origin + "/templates/law-firm-counsel");
    await preview
      .frameLocator("iframe")
      .getByRole("heading", { name: "ALDEN & ROWE", exact: true })
      .waitFor();
    assert.ok(
      (
        await preview
          .getByRole("link", { name: "Select Template" })
          .getAttribute("href")
      ).endsWith("?template=law-firm-counsel"),
    );
    for (const path of [
      "",
      "/about",
      "/practice-areas",
      "/practice-areas/business-law",
      "/attorneys",
      "/insights",
      "/insights/preparing-for-a-first-legal-consultation",
      "/contact",
    ]) {
      const response = await page.request.get(
        origin + "/template-canvas/law-firm-counsel" + path,
      );
      assert.equal(response.status(), 200, path);
      assert.ok((await response.text()).includes("Alden &amp; Rowe"));
    }
    await preview.goto(origin + "/template-canvas/law-firm-counsel");
    await preview
      .getByRole("link", { name: "Request a consultation" })
      .first()
      .click();
    await preview.waitForURL(/\/contact/);
    await preview
      .getByLabel("Your name", { exact: true })
      .fill("Example Guest");
    await preview
      .getByLabel("Email address", { exact: true })
      .fill("example@example.test");
    await preview
      .getByLabel("Phone number", { exact: true })
      .fill("+2347000000000");
    await preview
      .getByLabel("Brief enquiry", { exact: true })
      .fill("A general consultation request.");
    await preview.getByRole("button", { name: "Send general enquiry" }).click();
    await preview
      .getByRole("alert")
      .filter({ hasText: "No enquiry was sent" })
      .waitFor();
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
