// Local template preview only: no real store, purchase, email or customer writes.
const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const origin = process.env.MAIN_TEST_ORIGIN || "http://127.0.0.1:3030",
    out = "/tmp/jktl-jewellery-browser";
  fs.mkdirSync(out, { recursive: true });
  const c = await import("../src/lib/website-templates.ts"),
    t = c.getWebsiteTemplate("jewellery-luxe");
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const [width, reduced] of [
      [1440, false],
      [390, false],
      [320, true],
    ]) {
      const p = await b.newPage({
          viewport: { width, height: 1000 },
          reducedMotion: reduced ? "reduce" : "no-preference",
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const r = await p.goto(origin + "/template-canvas/jewellery-luxe");
      if (r.status() !== 200) throw Error("Home " + r.status());
      await p
        .getByRole("heading", { level: 1, name: /Small details/ })
        .waitFor();
      const signin = p.getByRole("link", { name: "Sign in to JKTL Business" });
      if (
        !(await signin.isVisible()) ||
        !(await signin.getAttribute("href")).endsWith(
          "?template=jewellery-luxe",
        )
      )
        throw Error("Sign-in context/visibility");
      if (width < 761) {
        await p.getByRole("button", { name: "Open menu" }).click();
        await p
          .getByRole("navigation", { name: "Mobile boutique navigation" })
          .getByRole("link", { name: "Earrings", exact: true })
          .click();
      } else
        await p
          .getByRole("navigation", { name: "Boutique navigation", exact: true })
          .getByRole("link", { name: "Earrings", exact: true })
          .click();
      await p.waitForURL("**/jewellery-luxe/shop/earrings");
      await p.getByRole("heading", { level: 1, name: "Earrings" }).waitFor();
      if (
        await p
          .locator("main")
          .getByRole("heading", { name: "The Lightcatcher Ring" })
          .count()
      )
        throw Error("Category filter leaked other products");
      await p.getByLabel("Search products").fill("nothing matches this");
      await p
        .getByRole("status")
        .filter({ hasText: "No pieces match" })
        .waitFor();
      await p.getByLabel("Search products").fill("");
      await p.locator("main article a").first().click();
      await p.waitForURL("**/pieces/sculpted-leaf-earrings");
      await p
        .getByRole("heading", { level: 1, name: "Sculpted Leaf Earrings" })
        .waitFor();
      if (await p.getByRole("button", { name: /checkout|pay now/i }).count())
        throw Error("Unimplemented checkout shown");
      await p.getByRole("link", { name: "Enquire about this piece" }).click();
      await p.waitForURL(/\/jewellery-luxe\/contact\?piece=/);
      await p.waitForFunction(() =>
        document
          .querySelector("textarea[name=message]")
          ?.value.includes("Sculpted Leaf Earrings"),
      );
      await p.getByLabel("Your name").fill("Preview visitor");
      await p
        .getByLabel("Email address", { exact: true })
        .fill("preview@example.test");
      await p.getByLabel("Your enquiry").fill("Preview only; do not send.");
      await p.getByRole("button", { name: "Prepare enquiry" }).click();
      await p
        .getByRole("status")
        .filter({ hasText: "No enquiry has been sent" })
        .waitFor();
      for (const suffix of [
        "",
        "shop",
        "shop/rings",
        "about",
        "editorial",
        "care",
        "contact",
      ]) {
        await p.goto(
          origin +
            "/template-canvas/jewellery-luxe" +
            (suffix ? "/" + suffix : ""),
        );
        await p.locator("h1").waitFor();
        if ((await p.locator("h1").count()) !== 1) throw Error("H1 " + suffix);
        for (const im of await p.locator("img").all()) {
          await im.scrollIntoViewIfNeeded();
          await im.evaluate(async i=>{i.loading="eager";await i.decode().catch(()=>{})});
        }
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
          throw Error("Overflow " + width + " " + suffix);
        if (!suffix || suffix === "shop")
          await p.screenshot({
            path: out + "/" + (suffix || "home") + "-" + width + ".png",
            fullPage: true,
          });
      }
      if (errors.length) throw Error(errors.join("\n"));
      console.log(
        JSON.stringify({
          width,
          reduced,
          categoryPages: true,
          productPages: true,
          search: true,
          previewEnquiry: true,
          photos: true,
        }),
      );
      await p.close();
    }
    const p = await b.newPage({ viewport: { width: 1000, height: 676 } });
    for (const suffix of c.websitePagePaths(t)) {
      const r = await p.request.get(
        origin +
          "/template-canvas/jewellery-luxe" +
          (suffix ? "/" + suffix : ""),
      );
      if (r.status() !== 200) throw Error(suffix + " HTTP " + r.status());
      const html = await r.text();
      if (
        (html.match(/<h1[\s>]/g) || []).length !== 1 ||
        !html.includes("noindex")
      )
        throw Error("SSR/robots " + suffix);
    }
    if (
      (
        await p.request.get(
          origin + "/template-canvas/jewellery-luxe/pieces/does-not-exist",
        )
      ).status() !== 404
    )
      throw Error("Unknown product not 404");
    await p.goto(origin + "/template-canvas/jewellery-luxe");
    await p
      .getByRole("link", { name: "Nacre & Gold", exact: true })
      .first()
      .waitFor();
    await p.waitForFunction(
      () =>
        document.images[0]?.complete && document.images[0]?.naturalWidth > 0,
    );
    await p.evaluate(() => document.fonts.ready);
    const thumb = path.resolve(
      __dirname,
      "../public/template-previews/jewellery-luxe.jpg",
    );
    await p.screenshot({ path: thumb, type: "jpeg", quality: 78 });
    fs.copyFileSync(
      thumb,
      path.resolve(
        __dirname,
        "../../jktl-main/public/template-previews/jewellery-luxe.jpg",
      ),
    );
    await p.goto(origin + "/templates/jewellery-luxe");
    await p.getByRole("link", { name: /Select Template/ }).waitFor();
    const url = await p
      .getByRole("link", { name: /Select Template/ })
      .getAttribute("href");
    if (!url.includes("template=jewellery-luxe"))
      throw Error("Selection context missing");
    console.log(
      "All " +
        c.websitePagePaths(t).length +
        " direct pages passed; thumbnail saved to both repositories. Screenshots: " +
        out,
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
