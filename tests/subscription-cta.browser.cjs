const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const response = await page.goto(
        (process.env.BASE_URL || "http://127.0.0.1:3194") + "/business/plans",
        { waitUntil: "domcontentloaded" },
      );
      assert.equal(response.status(), 200);
      await page.waitForURL("**/login?next=plans", { timeout: 20000 });
      const href = await page
        .getByRole("link", { name: /create.*account|sign up/i })
        .first()
        .getAttribute("href");
      assert.ok(href.includes("next=plans"));
      await page.screenshot({
        path: "/tmp/jktl-plans-login-" + width + ".png",
        fullPage: true,
      });
      await page.close();
      console.log(
        "PASS subscription CTA preserves plans through sign-in/signup at " +
          width +
          "px",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
