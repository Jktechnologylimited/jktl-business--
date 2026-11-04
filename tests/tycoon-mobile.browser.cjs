/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Chromium integration runner. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const THREE = require("three");
const origin = process.env.TYCOON_TEST_ORIGIN || "http://localhost:3158";
const saved = {
  version: 1,
  week: 5,
  cash: 500000,
  city: "Lagos",
  plots: Array.from({ length: 12 }, (_, i) =>
    i < 2 ? { kind: i === 0 ? "suya" : "salon", level: 1 } : null,
  ),
  digital: false,
  solar: false,
  debt: 0,
  log: ["Mobile layout test"],
};
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  try {
    for (const [width, height] of [
      [390, 844],
      [320, 568],
      [844, 390],
    ]) {
      const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: true,
          isMobile: true,
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.addInitScript(
        (state) =>
          localStorage.setItem("jktl-tycoon-guest-v1", JSON.stringify(state)),
        saved,
      );
      await page.route("**/api/tycoon", (route) =>
        route.fulfill({
          json: { signedIn: false, revision: 0, document: null },
        }),
      );
      await page.goto(origin + "/play/tycoon");
      const canvas = page.locator("canvas[data-webgl-ready]");
      await canvas.waitFor({ timeout: 60000 });
      await page
        .getByRole("button", { name: "Next week", exact: true })
        .waitFor();
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(
        await page.getByLabel("3D quality", { exact: true }).isVisible(),
        false,
      );
      assert.equal(
        await page.getByLabel("Featured luxury car").isVisible(),
        false,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Ⅱ Pause", exact: true })
          .isVisible(),
        false,
      );
      const rect = await canvas.boundingBox();
      assert.ok(
        rect.height >= height * 0.58,
        "Reserve most of the viewport for the city",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollHeight > innerHeight + 1,
        ),
        false,
        "Landscape must not be clipped by a minimum game height",
      );
      const clear = await page.evaluate((r) => {
        let total = 0,
          free = 0;
        for (let y = 1; y <= 5; y++)
          for (let x = 1; x <= 5; x++) {
            total++;
            const node = document.elementFromPoint(
              r.x + (r.width * x) / 6,
              r.y + (r.height * y) / 6,
            );
            if (node?.tagName === "CANVAS") free++;
          }
        return free / total;
      }, rect);
      assert.equal(
        clear,
        1,
        "No persistent interface should cover the city canvas",
      );
      await page.screenshot({
        path: `/workspace/exports/tycoon-mobile-clear-${width}x${height}.png`,
      });
      if (width === 390) {
        const camera = new THREE.OrthographicCamera(
          -rect.width / 2,
          rect.width / 2,
          rect.height / 2,
          -rect.height / 2,
          0.1,
          120,
        );
        camera.position.set(19, 21, 19);
        camera.lookAt(0, 0, 0);
        camera.zoom = Math.max(
          12,
          Math.min(rect.width / 24, rect.height / 19, 62),
        );
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const point = new THREE.Vector3(1.5, 0.24, -3.5).project(camera);
        await canvas.click({
          position: {
            x: ((point.x + 1) * rect.width) / 2,
            y: ((1 - point.y) * rect.height) / 2,
          },
        });
        await page
          .getByRole("button", { name: "Open business", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Open business", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector("main[data-panel]").dataset.panel === "none",
        );
        assert.ok(
          JSON.parse(
            await page.evaluate(() =>
              localStorage.getItem("jktl-tycoon-guest-v1"),
            ),
          ).plots[2],
        );
        await page
          .getByRole("button", { name: "Next week", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            JSON.parse(localStorage.getItem("jktl-tycoon-guest-v1")).week === 6,
        );
        await page.getByRole("button", { name: "More", exact: true }).click();
        await page
          .getByRole("heading", { name: "Game menu", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "How to play", exact: true })
          .click();
        await page
          .getByText("All money, costs and market events are fictional.", {
            exact: false,
          })
          .waitFor();
        await page
          .getByRole("button", { name: "Close game panel", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Open city controls", exact: true })
          .click();
        await page
          .getByRole("combobox", { name: "Featured luxury car" })
          .selectOption("cybertruck");
        await page
          .getByRole("button", { name: "Ⅱ Pause", exact: true })
          .click();
        assert.equal(
          await page.locator("[data-renderer]").getAttribute("data-animated"),
          "false",
        );
        await page
          .getByRole("button", { name: "Close city controls", exact: true })
          .click();
        await page.waitForTimeout(3500);
        const before = await canvas.screenshot();
        const cdp = await context.newCDPSession(page);
        const x = rect.x + rect.width * 0.6,
          y = rect.y + rect.height * 0.5;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let i = 1; i <= 5; i++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + 9 * i, y: y + 5 * i }],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await page.waitForTimeout(300);
        const after = await canvas.screenshot();
        assert.equal(
          before.equals(after),
          false,
          "One-finger drag must pan the paused 3D world",
        );
        assert.equal(
          await page.locator("main[data-panel]").getAttribute("data-panel"),
          "none",
          "Panning must not select a plot",
        );
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS: clear canvas on 390/320px and landscape; no PWA popup; plot building, next week, menus, settings, one-finger pan and preserved game state.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
