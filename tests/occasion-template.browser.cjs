// Local previews only. Forms are checked in preview mode; no client records or emails are created.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const catalog = await import("../src/lib/website-templates.ts");
  const origins = (
    process.env.OCCASION_TEST_ORIGINS ||
    "http://localhost:3224,http://localhost:3225"
  ).split(",");
  const ids = (
    process.env.OCCASION_TEST_IDS || "bridal-aura,nail-culture"
  ).split(",");
  const out = "/tmp/jktl-occasion-browser";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const [originIndex, origin] of origins.entries()) {
      const site = originIndex === 0 ? "main" : "business";
      for (const width of [1440, 390, 320]) {
        const p = await browser.newPage({
          viewport: { width, height: 950 },
          reducedMotion: width === 320 ? "reduce" : "no-preference",
        });
        p.setDefaultTimeout(60000);
        const errors = [];
        await p.route("**/api/public/features", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ features: [] }),
          }),
        );
        p.on("pageerror", (e) => errors.push(e.message));
        p.on("console", (message) => {
          if (
            message.type() === "error" &&
            /hydration|hydrating|did not match|server rendered/i.test(
              message.text(),
            )
          )
            errors.push(message.text());
        });
        for (const id of ids) {
          const template = catalog.getWebsiteTemplate(id),
            doc = template.document;
          const base = origin + "/template-canvas/" + id;
          const response = await p.goto(base);
          assert.equal(response.status(), 200);
          await p
            .locator("[data-occasion-template], [data-tattoo-template] h1")
            .waitFor();
          await p.evaluate(() => document.fonts.ready);
          await p.waitForFunction(() =>
            Array.from(document.images)
              .filter((i) => i.getBoundingClientRect().top < innerHeight)
              .every((i) => i.complete && i.naturalWidth),
          );
          assert.equal(await p.locator("h1").count(), 1);
          assert.equal(
            await p
              .getByRole("link", { name: "Sign in to JKTL Business" })
              .getAttribute("href"),
            "https://business.jktl.com.ng/login?template=" + id,
          );
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await p.screenshot({
            caret: "initial",
            path: `${out}/${site}-${id}-${width}.png`,
            fullPage: false,
          });
          if (id === "bridal-aura") {
            const old = await p
              .locator('[aria-live="polite"] img')
              .getAttribute("src");
            await p
              .getByRole("button", { name: /Show bridal photograph 2:/ })
              .click();
            await p.waitForFunction(() =>
              document.querySelector(
                '[aria-pressed="true"][aria-label^="Show bridal photograph 2:"]',
              ),
            );
            assert.notEqual(
              await p.locator('[aria-live="polite"] img').getAttribute("src"),
              old,
            );
          }
          if (width < 700) {
            await p
              .getByRole("button", { name: "Open menu", exact: true })
              .click();
            await p
              .getByRole("navigation", { name: "Mobile studio navigation" })
              .getByRole("link", { name: "Services", exact: true })
              .click();
          } else
            await p
              .getByRole("navigation", {
                name: "Studio navigation",
                exact: true,
              })
              .getByRole("link", { name: "Services", exact: true })
              .click();
          await p.waitForURL("**/" + id + "/services");
          assert.equal(
            await p
              .getByRole("navigation", { name: "Mobile studio navigation" })
              .count(),
            0,
          );
          await p
            .getByRole("link", {
              name: "Explore " + doc.offerings[0].title,
              exact: true,
            })
            .click();
          await p
            .getByRole("heading", {
              level: 1,
              name: doc.offerings[0].title,
              exact: true,
            })
            .waitFor();
          await p.getByRole("link", { name: "Request this service" }).click();
          await p.waitForURL("**/" + id + "/book?service=*");
          await p.waitForFunction(
            (slug) =>
              document.querySelector('select[name="service"]')?.value === slug,
            catalog.beautyServiceSlug(doc.offerings[0], 0),
          );
          await p
            .getByLabel("Your name", { exact: true })
            .fill("Preview visitor");
          await p
            .getByLabel("Email address", { exact: true })
            .fill("preview@example.test");
          await p
            .getByLabel("Phone number", { exact: true })
            .fill("08090000000");
          await p
            .getByLabel("Preferred date", { exact: true })
            .fill("2026-12-01");
          await p
            .getByLabel("Preferred time (WAT)", { exact: true })
            .fill("11:00");
          await p
            .getByRole("button", { name: "Send appointment request" })
            .click();
          await p
            .getByRole("alert")
            .filter({
              hasText: "This is a template preview. No request was sent.",
            })
            .waitFor();
          for (const section of ["about", "gallery", "contact"]) {
            assert.equal((await p.goto(base + "/" + section)).status(), 200);
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
              id + "/" + section + ": " + width,
            );
          }
          if (doc.beauty?.design === "tattoo") {
            await p.goto(base + "/guest-spots");
            await p
              .getByRole("link", { name: "Visit details", exact: true })
              .first()
              .click();
            await p
              .getByRole("heading", {
                level: 1,
                name: doc.beauty.guestSpots[0].studio,
                exact: true,
              })
              .waitFor();
            await p
              .getByRole("link", {
                name: "Enquire about this visit",
                exact: true,
              })
              .click();
            await p.waitForURL("**/contact?guest=*");
            await p.getByLabel("Your message", { exact: true }).waitFor();
            await p.waitForFunction(
              (studio) =>
                document
                  .querySelector('textarea[name="message"]')
                  ?.value.includes(studio),
              doc.beauty.guestSpots[0].studio,
            );
          }
          assert.equal(await p.locator("form").count(), 1);
          assert.equal(
            await p
              .locator("form")
              .getByText("no request will be submitted", { exact: false })
              .count(),
            1,
          );
          if (width === 1440) {
            const titles = new Set();
            for (const route of catalog.websitePagePaths(template)) {
              const res = await p.request.get(
                base + (route ? "/" + route : ""),
              );
              assert.equal(res.status(), 200);
              const html = await res.text();
              assert.equal(
                (html.match(/<h1[\s>]/g) || []).length,
                1,
                id + "/" + route,
              );
              assert.match(html, /noindex/);
              titles.add(html.match(/<title>([^<]+)<\/title>/)?.[1]);
            }
            assert.equal(
              titles.size,
              catalog.websitePagePaths(template).length,
            );
            assert.equal(
              (await p.request.get(base + "/retired-page")).status(),
              404,
            );
          }
          await p.goto(origin + "/templates/" + id);
          await p
            .frameLocator("iframe")
            .locator("[data-occasion-template], [data-tattoo-template]")
            .waitFor();
          const selection = p.getByRole("link", { name: /Select Template/ });
          assert.equal(
            await selection.getAttribute("href"),
            "https://business.jktl.com.ng/login?template=" + id,
          );
          // The existing wrapper uses automatic full-width previews on phones;
          // its device switch is shown on desktop screens.
          if (width >= 768) {
            await p
              .getByRole("button", { name: "Mobile preview", exact: true })
              .click();
            await p.waitForFunction(
              () =>
                document
                  .querySelector('[aria-label="Mobile preview"]')
                  ?.getAttribute("aria-pressed") === "true",
            );
          }
          await p
            .frameLocator("iframe")
            .getByRole("button", { name: "Open menu", exact: true })
            .click();
          await p
            .frameLocator("iframe")
            .getByRole("navigation", { name: "Mobile studio navigation" })
            .getByRole("link", { name: "Gallery", exact: true })
            .click();
          await p
            .frameLocator("iframe")
            .getByRole("heading", {
              level: 1,
              name: doc.galleryTitle,
              exact: true,
            })
            .waitFor();
          if (width >= 768)
            await p
              .getByRole("button", { name: "Desktop preview", exact: true })
              .click();
          await p
            .frameLocator("iframe")
            .getByRole("heading", {
              level: 1,
              name: doc.galleryTitle,
              exact: true,
            })
            .waitFor();
        }
        assert.deepEqual(errors, []);
        console.log(
          JSON.stringify({
            site,
            width,
            templates: ids,
            multipage: true,
            serviceSelection: true,
            honestPreviewForm: true,
            responsivePreview: true,
            noOverflow: true,
          }),
        );
        await p.close();
      }
      const p = await browser.newPage({
        viewport: { width: 1000, height: 800 },
      });
      await p.route("**/api/public/features", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ features: [] }),
        }),
      );
      if (originIndex === 0) {
        for (const id of ids) {
          await p.goto(origin + "/template-canvas/" + id);
          await p.evaluate(() => document.fonts.ready);
          await p.waitForFunction(() =>
            Array.from(document.images)
              .filter((i) => i.getBoundingClientRect().top < innerHeight)
              .every((i) => i.complete && i.naturalWidth),
          );
          await p.screenshot({
            caret: "initial",
            path: path.resolve(
              __dirname,
              "../public/template-previews/" + id + ".jpg",
            ),
            type: "jpeg",
            quality: 78,
            clip: { x: 0, y: 0, width: 1000, height: 676 },
          });
        }
      }
      await p.goto(origin + "/templates");
      for (const id of ids) {
        const template = catalog.getWebsiteTemplate(id);
        await p
          .getByPlaceholder(/Search all templates/)
          .fill(template.document.brandName);
        const card = p.getByRole("link", {
          name: "View " + template.name + " template",
          exact: true,
        });
        await card.waitFor();
        assert.equal(await card.getAttribute("target"), "_blank");
        assert.equal(await card.getAttribute("href"), "/templates/" + id);
      }
      await p.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
