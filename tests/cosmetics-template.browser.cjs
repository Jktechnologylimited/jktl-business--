// Local preview tests only: no product orders, live enquiries or emails are sent.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const catalog = await import("../src/lib/website-templates.ts"),
    template = catalog.getWebsiteTemplate("velora-cosmetics"),
    doc = template.document;
  const origins = (
    process.env.COSMETICS_TEST_ORIGINS ||
    "http://localhost:3234,http://localhost:3235"
  ).split(",");
  const out = "/tmp/jktl-cosmetics-browser";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const [index, origin] of origins.entries()) {
      for (const width of [1440, 390, 320]) {
        const p = await browser.newPage({
            viewport: { width, height: 950 },
            reducedMotion: width === 320 ? "reduce" : "no-preference",
          }),
          errors = [];
        await p.route("**/api/public/features", (r) =>
          r.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: '{"features":[]}',
          }),
        );
        p.on("pageerror", (e) => errors.push(e.message));
        p.on("console", (m) => {
          if (
            m.type() === "error" &&
            /hydration|did not match|server rendered/i.test(m.text())
          )
            errors.push(m.text());
        });
        const base = origin + "/template-canvas/" + template.id;
        assert.equal((await p.goto(base)).status(), 200);
        await p.locator("h1").waitFor();
        await p.evaluate(() => document.fonts.ready);
        await p.waitForLoadState("networkidle");
        await p.waitForFunction(() =>
          Array.from(document.images)
            .filter((i) => i.getBoundingClientRect().top < innerHeight)
            .every((i) => i.complete && i.naturalWidth),
        );
        assert.equal(await p.locator("h1").count(), 1);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.equal(
          await p
            .getByRole("link", { name: "Sign in to JKTL Business" })
            .getAttribute("href"),
          "https://business.jktl.com.ng/login?template=" + template.id,
        );
        await p.screenshot({
          path: `${out}/${index === 0 ? "main" : "business"}-home-${width}.png`,
        });
        await p
          .getByRole("button", { name: "Next products", exact: true })
          .click();
        await p.waitForFunction(
          () =>
            document.querySelector('[aria-label="Featured beauty products"]')
              .scrollLeft > 0,
        );
        await p
          .getByRole("link", { name: "Explore Colour collection", exact: true })
          .click();
        await p.waitForURL("**/shop/colour");
        assert.equal(await p.locator("main article").count(), 2);
        await p
          .getByRole("navigation", { name: "Collection categories" })
          .getByRole("link", { name: "All products", exact: true })
          .click();
        await p.waitForURL("**/" + template.id + "/shop");
        await p
          .getByRole("searchbox", {
            name: "Search the collection",
            exact: true,
          })
          .fill("lipstick");
        await p.waitForFunction(
          () => document.querySelectorAll("main article").length === 1,
        );
        await p
          .getByRole("link", {
            name: "Explore The colour-story lipstick",
            exact: true,
          })
          .click();
        await p.waitForURL("**/products/colour-story-lipstick");
        await p
          .getByRole("heading", {
            level: 1,
            name: "The colour-story lipstick",
            exact: true,
          })
          .waitFor();
        await p
          .getByRole("link", { name: "Ask about this product", exact: true })
          .click();
        await p.waitForURL("**/contact?product=colour-story-lipstick");
        await p.waitForFunction(() =>
          document
            .querySelector('textarea[name="message"]')
            ?.value.includes("The colour-story lipstick"),
        );
        await p
          .getByLabel("Your name", { exact: true })
          .fill("Preview visitor");
        await p
          .getByLabel("Email address", { exact: true })
          .fill("preview@example.test");
        await p.getByLabel("Phone number", { exact: true }).fill("08090000000");
        await p
          .getByRole("button", { name: "Send your message", exact: true })
          .click();
        await p
          .getByRole("alert")
          .filter({
            hasText: "This is a template preview. No request was sent.",
          })
          .waitFor();
        for (const route of [
          "shop",
          "shop/skin",
          "about",
          "editorial",
          "care",
          "contact",
        ]) {
          assert.equal((await p.goto(base + "/" + route)).status(), 200);
          assert.equal(await p.locator("h1").count(), 1);
          // Trigger native lazy loading without changing SSR attributes.
          for (const photo of await p.locator("img").all()) {
            if (await photo.isVisible()) await photo.scrollIntoViewIfNeeded();
          }
          await p.waitForFunction(() =>
            Array.from(document.images).every(
              (i) => i.complete && i.naturalWidth,
            ),
          );
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            route + ":" + width,
          );
        }
        if (width === 1440) {
          const titles = new Set();
          for (const route of catalog.websitePagePaths(template)) {
            const r = await p.request.get(base + (route ? "/" + route : ""));
            assert.equal(r.status(), 200);
            const html = await r.text();
            assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
            assert.match(html, /noindex/);
            titles.add(html.match(/<title>([^<]+)<\/title>/)?.[1]);
          }
          assert.equal(titles.size, 15);
          assert.equal((await p.request.get(base + "/checkout")).status(), 404);
        }
        await p.goto(origin + "/templates/" + template.id);
        await p
          .frameLocator("iframe")
          .locator("[data-cosmetics-template]")
          .waitFor();
        assert.equal(
          await p
            .getByRole("link", { name: /Select Template/ })
            .getAttribute("href"),
          "https://business.jktl.com.ng/login?template=" + template.id,
        );
        if (width >= 768)
          await p
            .getByRole("button", { name: "Mobile preview", exact: true })
            .click();
        const frame = p.frameLocator("iframe");
        await frame
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
        await frame
          .getByRole("navigation", {
            name: "Mobile beauty boutique navigation",
          })
          .getByRole("link", { name: "Shop the collection", exact: true })
          .click();
        await frame
          .getByRole("heading", {
            level: 1,
            name: "Shop the collection",
            exact: true,
          })
          .waitFor();
        if (width >= 768)
          await p
            .getByRole("button", { name: "Desktop preview", exact: true })
            .click();
        await frame
          .getByRole("heading", {
            level: 1,
            name: "Shop the collection",
            exact: true,
          })
          .waitFor();
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            site: index === 0 ? "main" : "business",
            width,
            carousel: true,
            categories: true,
            search: true,
            productEnquiry: true,
            publicPreview: true,
            noOverflow: true,
          }),
        );
        await p.close();
      }
      const p = await browser.newPage({
        viewport: { width: 1000, height: 800 },
      });
      await p.route("**/api/public/features", (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"features":[]}',
        }),
      );
      if (index === 0) {
        await p.goto(origin + "/template-canvas/" + template.id);
        await p.evaluate(() => document.fonts.ready);
        await p.waitForFunction(() =>
          Array.from(document.images)
            .filter((i) => i.getBoundingClientRect().top < innerHeight)
            .every((i) => i.complete && i.naturalWidth),
        );
        await p.screenshot({
          path: path.resolve(
            __dirname,
            "../public/template-previews/" + template.id + ".jpg",
          ),
          type: "jpeg",
          quality: 78,
          clip: { x: 0, y: 0, width: 1000, height: 676 },
        });
      }
      await p.goto(origin + "/templates");
      await p.getByPlaceholder(/Search all templates/).fill(doc.brandName);
      const card = p.getByRole("link", {
        name: "View " + template.name + " template",
        exact: true,
      });
      await card.waitFor();
      assert.equal(await card.getAttribute("target"), "_blank");
      await p.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
