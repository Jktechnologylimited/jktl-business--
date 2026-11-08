// Local public previews only: no customer site, enquiry, email or deployment is created.
const { chromium } = require("playwright"),
  fs = require("node:fs");
(async () => {
  const origin = process.env.MAIN_TEST_ORIGIN || "http://127.0.0.1:3022",
    out = "/tmp/jktl-multipage-browser";
  fs.mkdirSync(out, { recursive: true });
  const catalogue = await import("../src/lib/website-templates.ts");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const [width, reduced] of [
      [1440, false],
      [390, false],
      [320, true],
    ]) {
      const p = await browser.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: reduced ? "reduce" : "no-preference",
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(origin + "/template-canvas/dressmaker-atelier");
      await p.getByRole("heading", { level: 1, name: /Made to be/ }).waitFor();
      const signin = p.getByRole("link", { name: "Sign in to JKTL Business" });
      if (!(await signin.isVisible())) throw Error("Sign-in icon hidden");
      if (
        (await signin.getAttribute("href")) !==
        "https://business.jktl.com.ng/login?template=dressmaker-atelier"
      )
        throw Error("Template selection lost");
      if (width < 700) {
        await p.getByRole("button", { name: "Open menu" }).click();
        await p
          .getByRole("navigation", { name: "Mobile atelier navigation" })
          .getByRole("link", { name: "Collection", exact: true })
          .click();
      } else
        await p
          .getByRole("navigation", { name: "Atelier navigation", exact: true })
          .getByRole("link", { name: "Collection", exact: true })
          .click();
      await p.waitForURL("**/dressmaker-atelier/collection");
      if (
        await p
          .getByRole("navigation", { name: "Mobile atelier navigation" })
          .count()
      )
        throw Error("Mobile menu did not close");
      await p
        .getByRole("link", { name: "View The Ivory Story", exact: true })
        .click();
      await p.waitForURL("**/collection/the-ivory-story");
      await p
        .getByRole("heading", { level: 1, name: "The Ivory Story" })
        .waitFor();
      await p.goBack();
      await p.waitForURL("**/dressmaker-atelier/collection");
      await p
        .getByRole("link", { name: "View The Silver Hour", exact: true })
        .click();
      await p.getByRole("link", { name: "Discuss this look" }).click();
      await p.waitForURL("**/dressmaker-atelier/contact");
      await p.getByLabel("Your name").fill("Preview Visitor");
      await p
        .getByLabel("Email address", { exact: true })
        .fill("preview@example.test");
      await p
        .getByLabel("Tell us about your occasion")
        .fill("Preview only. Do not send.");
      await p
        .locator("form")
        .getByRole("button", { name: "Request a consultation" })
        .click();
      await p
        .getByRole("status")
        .filter({ hasText: "This is a template preview" })
        .waitFor();
      for (const path of [
        "atelier",
        "collection",
        "our-process",
        "gallery",
        "faqs",
        "contact",
      ]) {
        const res = await p.goto(
          origin + "/template-canvas/dressmaker-atelier/" + path,
        );
        if (res.status() !== 200)
          throw Error("Dressmaker page " + path + " " + res.status());
        await p.locator("h1").waitFor();
        if ((await p.locator("h1").count()) !== 1)
          throw Error("Duplicate H1 " + path);
        for (const im of await p.locator("img").all())
          await im.evaluate((i) => (i.loading = "eager"));
        await p.waitForFunction(() =>
          Array.from(document.images).every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        );
        if (
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw Error("Overflow " + width + " " + path);
        if (path === "collection")
          await p.screenshot({
            path: out + "/collection-" + width + ".png",
            fullPage: true,
          });
      }
      // Generic industry websites use real URLs too, preserving modified-click hrefs.
      await p.goto(origin + "/template-canvas/fashion");
      if (width < 700) await p.getByRole("button", { name: /Menu/ }).click();
      await p
        .getByRole("navigation", { name: "Forma Studio website" })
        .getByRole("link", { name: "About", exact: true })
        .click();
      await p.waitForURL("**/fashion/about");
      await p.getByRole("heading", { level: 1, name: "About us" }).waitFor();
      await p
        .locator('nav[aria-label="More website pages"] a[href$="/contact"]')
        .click();
      await p.waitForURL("**/fashion/contact");
      if (errors.length) throw Error(errors.join("\n"));
      console.log(
        JSON.stringify({
          width,
          reduced,
          dressmakerPages: true,
          individualLook: true,
          browserBack: true,
          genericPages: true,
          previewEnquiry: true,
        }),
      );
      await p.close();
    }
    const p = await browser.newPage();
    for (const id of [
      "dressmaker-atelier",
      "fashion",
      "church",
      "blank-website",
      "beauty-atelier",
      "law-firm-counsel",
    ]) {
      const t = catalogue.getWebsiteTemplate(id);
      for (const path of catalogue.websitePagePaths(t)) {
        const r = await p.request.get(
          origin + "/template-canvas/" + id + (path ? "/" + path : ""),
        );
        if (r.status() !== 200)
          throw Error(id + "/" + path + " returned " + r.status());
        const html = await r.text();
        if ((html.match(/<h1[\s>]/g) || []).length !== 1)
          throw Error("Server H1 " + id + "/" + path);
        if (!html.includes("noindex")) throw Error("Raw preview indexable");
      }
    }
    const salon = catalogue.getWebsiteTemplate("beauty-atelier"),
      service = catalogue.beautyServiceSlug(salon.document.offerings[0], 0);
    await p.goto(
      origin + "/template-canvas/beauty-atelier/book?service=" + service,
    );
    await p.waitForFunction(
      (s) => document.querySelector('select[name="service"]')?.value === s,
      service,
    );
    const landing = catalogue.websiteTemplates.find(
      (t) => catalogue.templatePageKind(t) === "landing",
    );
    if (
      (
        await p.request.get(
          origin + "/template-canvas/" + landing.id + "/about",
        )
      ).status() !== 404
    )
      throw Error("Landing exposed subpage");
    if (
      (
        await p.request.get(
          origin + "/template-canvas/dressmaker-atelier/not-a-page",
        )
      ).status() !== 404
    )
      throw Error("Invalid page exposed");
    await p.goto(origin + "/template-canvas/" + landing.id);
    const homeAnchors = await p.locator('a[href="#contact"]').count();
    if (!homeAnchors) throw Error("Landing lost anchor navigation");
    await p.goto(origin + "/templates/dressmaker-atelier");
    if (!(await p.content()).includes("dressmaker-atelier"))
      throw Error("Public wrapper unavailable");
    // Ordinary preview subpages should be cached rather than re-rendered on every request.
    const url = origin + "/template-canvas/fashion/about";
    await p.request.get(url);
    const r = await p.request.get(url);
    console.log(
      JSON.stringify({
        directPages: true,
        unknown404: true,
        landing404: true,
        serverH1: true,
        previewCache: r.headers()["x-nextjs-cache"] || "not-reported",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
