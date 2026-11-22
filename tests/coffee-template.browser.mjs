import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyFileSync } from "node:fs";

// Local public previews only. No production writes, email or payment calls.
const { chromium } = createRequire(import.meta.url)("playwright");
const businessApp = process.env.COFFEE_TEST_APP === "business";
// Business treats unknown hosts as custom domains; localhost keeps this test DB-free.
const origin = process.env.COFFEE_TEST_ORIGIN || (businessApp ? "http://localhost:3318" : "http://127.0.0.1:3317");
const capturePrefix = businessApp ? "business-kora-coffee" : "kora-coffee";
const base = origin + "/template-canvas/kora-coffee";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(base);
    assert.equal(response.status(), 200);
    await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = "eager"; });
    await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator('[data-page-kind="landing"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
    const screenshot = await page.screenshot({ path: `/tmp/${capturePrefix}-home-${width}.png`, fullPage: true });
    assert.equal(screenshot.readUInt32BE(16), width, `Decorative content extends the ${width}px screenshot`);
    if (width < 1100) {
      const toggle = page.getByRole("button", { name: "Open menu", exact: true });
      await toggle.click();
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await toggle.evaluate(element => document.activeElement === element), true);
      await toggle.click();
    }
    await page.getByRole("navigation", { name: "Main website navigation" }).getByRole("link", { name: "The menu", exact: true }).click();
    await page.waitForURL(base + "#offerings");
    const filters = page.getByRole("group", { name: "Filter the coffee menu" });
    await filters.getByRole("button", { name: "Iced drinks", exact: true }).click();
    assert.match(await page.locator('#offerings [role="status"]').innerText(), /1 item/);
    assert.equal(await page.locator("article").count(), 1);
    await page.getByRole("link", { name: "Ask about Iced latte", exact: true }).click();
    await page.waitForURL(base + "#contact");
    assert.match(await page.locator('textarea[name="message"]').inputValue(), /Iced latte/);
    assert.match(await page.locator("#contact").innerText(), /Your enquiry: Iced latte/);
    const submit = page.locator('form button[type="submit"]');
    await submit.click();
    assert.equal(await page.locator('input[name="name"]').evaluate(element => element.validity.valueMissing), true);
    for (const [name, value] of [["name", "Template Preview"], ["email", "preview@example.test"], ["phone", "+2348090000000"]]) await page.locator(`input[name="${name}"]`).fill(value);
    await submit.click();
    const formError = page.locator('form [role="alert"]');
    await formError.waitFor();
    assert.match(await formError.innerText(), /No request was sent/);
    assert.equal(new URL(page.url()).pathname, "/template-canvas/kora-coffee");
    await page.locator("summary").first().click();
    assert.equal(await page.locator("details").first().getAttribute("open"), "");
    for (const section of ["home", "offerings", "about", "approach", "gallery", "questions", "contact"]) assert.equal(await page.locator("#" + section).count(), 1);
    assert.deepEqual(errors, []);
    assert.equal((await page.request.get(base + "/menu")).status(), 404);
    await page.close();
    console.log(`Passed ${width}px coffee landing page: section links, mobile menu, menu filters, inline enquiry and subpage 404.`);
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(base);
  await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = "eager"; });
  await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
  if (!businessApp) {
    const thumbnail = new URL("../../jktl-main/public/template-previews/kora-coffee.jpg", import.meta.url);
    await page.screenshot({ path: thumbnail.pathname, type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: 1440, height: 960 } });
    copyFileSync(thumbnail, new URL("../public/template-previews/kora-coffee.jpg", import.meta.url));
  }
  await page.goto(origin + "/templates/kora-coffee");
  if (!businessApp) assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.getByRole("link", { name: "Select Template" }).getAttribute("href"), "https://business.jktl.com.ng/login?template=kora-coffee");
  await page.frameLocator('iframe[title="Coffee Shop Landing Page — Kora website preview"]').locator("h1").waitFor();
  await page.close();
  console.log(`Verified the ${businessApp ? "Business" : "Main"} public landing-page selection flow with motion enabled.`);
} finally {
  await browser.close();
}
