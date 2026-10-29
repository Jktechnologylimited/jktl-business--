const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const origin = process.env.PREVIEW_TEST_ORIGIN || "http://localhost:3102";
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await b.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|hydrating|did not match/i.test(m.text())
      )
        errors.push(m.text());
    });
    const paths = [
      "",
      "about",
      "services",
      "services/cut-and-finish",
      "services/colour-and-gloss",
      "services/texture-and-care",
      "services/occasion-styling",
      "gallery",
      "book",
      "contact",
    ];
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      for (const path of paths) {
        const url =
          origin + "/template-canvas/hair-salon" + (path ? "/" + path : "");
        assert.equal((await p.goto(url)).status(), 200, path);
        await p.locator("h1").waitFor();
        // Scroll naturally to trigger lazy loading; do not mutate SSR
        // attributes before hydration just to prepare a screenshot.
        for (const image of await p.locator("main img:visible").all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element) => element.decode());
          assert.ok(
            await image.evaluate((element) => element.naturalWidth > 0),
          );
        }
        await p.evaluate(() => window.scrollTo(0, 0));
        assert.equal(await p.locator("h1").count(), 1, path + " one h1");
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          path + " no overflow",
        );
        assert.ok(await p.locator("main").innerText());
        await p.screenshot({
          path:
            "/tmp/beauty-" +
            width +
            "-" +
            (path.replaceAll("/", "-") || "home") +
            ".png",
          fullPage: true,
        });
        if (width === 390) {
          await p.getByRole("button", { name: "Menu +", exact: true }).click();
          assert.equal(
            await p
              .getByRole("navigation", { name: "Salon navigation" })
              .isVisible(),
            true,
          );
          await p.getByRole("button", { name: "Close −", exact: true }).click();
        }
      }
      await p.goto(origin + "/templates/hair-salon");
      await p.frameLocator("iframe").locator("h1").waitFor();
      if (width === 1440) {
        await p
          .getByRole("button", { name: "Mobile preview", exact: true })
          .click();
        assert.ok(
          await p
            .locator("iframe")
            .evaluate((f) => f.contentWindow.innerWidth <= 390),
        );
      }
      const frame = p.frameLocator("iframe");
      if (
        await frame
          .getByRole("button", { name: "Menu +", exact: true })
          .isVisible()
      )
        await frame
          .getByRole("button", { name: "Menu +", exact: true })
          .click();
      await frame.getByRole("link", { name: "Our story", exact: true }).click();
      await p.waitForFunction(() =>
        document
          .querySelector("iframe")
          .contentWindow.location.pathname.endsWith("/about"),
      );
      assert.ok(
        (
          await p
            .getByRole("link", { name: "Select Template" })
            .getAttribute("href")
        ).endsWith("?template=hair-salon"),
      );
      assert.equal(new URL(p.url()).pathname, "/templates/hair-salon");
      if (
        await frame
          .getByRole("button", { name: "Menu +", exact: true })
          .isVisible()
      )
        await frame
          .getByRole("button", { name: "Menu +", exact: true })
          .click();
      await frame.getByRole("link", { name: "Gallery", exact: true }).click();
      await frame
        .getByRole("button", { name: /View image:/ })
        .first()
        .click();
      await p.waitForFunction(() => {
        const f = document.querySelector("iframe");
        const button = f?.contentDocument?.querySelector("dialog[open] button");
        if (!button) return false;
        const y =
          f.getBoundingClientRect().top + button.getBoundingClientRect().top;
        return y >= 74 && y < window.innerHeight - 44;
      });
      await frame.getByRole("button", { name: "Close image" }).click();
      assert.equal(
        await frame
          .getByRole("dialog", { name: "Salon gallery image" })
          .isVisible(),
        false,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(origin + "/template-canvas/hair-salon/gallery");
    await p.getByRole("button", { name: "Texture", exact: true }).click();
    assert.equal(
      await p.getByRole("button", { name: /View image:/ }).count(),
      1,
    );
    await p.getByRole("button", { name: /View image:/ }).click();
    await p.getByRole("dialog", { name: "Salon gallery image" }).waitFor();
    await p.keyboard.press("Escape");
    assert.equal(
      await p.getByRole("dialog", { name: "Salon gallery image" }).isVisible(),
      false,
    );
    await p.goto(
      origin + "/template-canvas/hair-salon/book?service=cut-and-finish",
    );
    await p.locator('input[name="name"]').fill("Preview Visitor");
    await p.locator('input[name="email"]').fill("preview@example.test");
    await p.locator('input[name="phone"]').fill("+2348090000000");
    assert.equal(
      await p.locator('select[name="service"]').inputValue(),
      "cut-and-finish",
    );
    await p.locator('input[name="date"]').fill("2026-11-10");
    await p.locator('input[name="time"]').fill("14:30");
    await p.getByRole("button", { name: "Send appointment request" }).click();
    await p.locator("form").getByRole("alert").waitFor();
    assert.match(
      await p.locator("form").getByRole("alert").innerText(),
      /No request was sent/,
    );
    assert.equal(
      await p.getByRole("status").filter({ hasText: "Thank you" }).count(),
      0,
    );
    assert.equal(
      (await p.goto(origin + "/template-canvas/hair-salon/not-real")).status(),
      404,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        origin +
        ": ten real pages at phone/desktop widths, loaded photographs, mobile navigation, in-frame multipage links, selection continuity, gallery filter/lightbox/keyboard, honest preselected preview booking, intentional 404 and no hydration errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
