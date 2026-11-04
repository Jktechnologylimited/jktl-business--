/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node/Chromium runner intentionally uses CommonJS. */
/* Explicit opt-in integration check against the configured DB; all records are isolated and removed.
   Start next dev with CHATBOT_PUBLIC_ORIGIN=http://localhost:3155. No email/AI calls. */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createServer } = require("node:http");
const { chromium } = require("playwright");
const { neon } = require("@neondatabase/serverless");
(async () => {
  if (process.env.CHATBOT_BROWSER_TEST !== "1")
    throw Error(
      "Set CHATBOT_BROWSER_TEST=1 to create and remove isolated browser fixtures.",
    );
  const sql = neon(process.env.DATABASE_URL),
    query = (s, p = []) => sql.query(s, p),
    org = randomUUID(),
    user = randomUUID(),
    admin = randomUUID(),
    slug = "test-" + randomUUID().slice(0, 8),
    base = "http://localhost:3155";
  let browser, host, botId;
  try {
    await query(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Chatbot browser test',$2)",
      [org, slug],
    );
    await query(
      "INSERT INTO users(id,name,email,password_hash) VALUES($1,'Chatbot test owner',$2,'disabled-test-login')",
      [user, slug + "@example.invalid"],
    );
    await query(
      "INSERT INTO organization_members(organization_id,user_id,name,email,role) VALUES($1,$2,'Test owner',$3,'owner')",
      [org, user, slug + "@example.invalid"],
    );
    await query(
      "INSERT INTO business_profiles(organization_id,display_name,subdomain,published) VALUES($1,'Browser test company',$2,true)",
      [org, slug],
    );
    const session = (
      await query(
        "INSERT INTO sessions(user_id,organization_id,expires_at) VALUES($1,$2,now()+interval '1 hour') RETURNING id",
        [user, org],
      )
    )[0].id;
    await query(
      "INSERT INTO admin_users(id,name,email,password_hash,role) VALUES($1,'Chatbot browser test',$2,'disabled-test-login','owner')",
      [admin, slug + "-admin@example.invalid"],
    );
    const adminSession = (
      await query(
        "INSERT INTO admin_sessions(admin_user_id,expires_at) VALUES($1,now()+interval '1 hour') RETURNING id",
        [admin],
      )
    )[0].id;
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const errors = [],
      context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addCookies([
      { name: "jktl_session", value: session, domain: "localhost", path: "/" },
      {
        name: "jktl_admin_session",
        value: adminSession,
        domain: "localhost",
        path: "/admin",
      },
    ]);
    await page.addInitScript(
      ({ org }) => {
        localStorage.setItem(
          "jktl-pwa-remind-after",
          String(Date.now() + 86400000),
        );
        localStorage.setItem(
          "jktl.session.v1",
          JSON.stringify({
            authenticated: true,
            onboardingComplete: true,
            mode: "live",
            organizationId: org,
            businessName: "Browser test company",
            businessType: "general",
          }),
        );
      },
      { org },
    );
    await page.goto(base + "/business/chatbot");
    await page
      .getByRole("heading", { name: /^JKTL AI Chatbot/ })
      .waitFor({ timeout: 60000 });
    console.log("Dashboard loaded");
    await page.getByLabel("Assistant name", { exact: true }).fill("Mika test");
    await page.getByLabel("Public chat slug").fill(slug);
    await page
      .getByRole("button", { name: "Create chatbot", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Saved." })
      .waitFor({ timeout: 30000 });
    console.log("Created chatbot");
    botId = (
      await query("SELECT id FROM chatbots WHERE organization_id=$1", [org])
    )[0].id;
    await page
      .getByRole("button", { name: "Knowledge Base", exact: true })
      .click();
    await page.getByLabel("Question or title").fill("Opening hours");
    await page
      .getByLabel("Approved answer or information")
      .fill("We open Monday to Friday, 9 AM to 5 PM WAT.");
    await page
      .getByRole("button", { name: "Save knowledge", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Opening hours", exact: true })
      .waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("WhatsApp number, including country code")
      .fill("+2348000000000");
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await page.waitForTimeout(1500);
    await page
      .getByRole("button", { name: "Installation", exact: true })
      .click();
    await page
      .getByLabel("Verified widget installation code")
      .waitFor({ timeout: 30000 });
    console.log("Installation loaded");
    await page.screenshot({
      path: "/workspace/exports/chatbot-installation-desktop.png",
      fullPage: true,
    });
    const chat = await context.newPage();
    chat.on("pageerror", (e) => errors.push(e.message));
    await chat.goto(base + "/chatbots/c/" + slug);
    await chat.getByRole("heading", { name: "Mika test" }).waitFor();
    await chat.getByLabel("Your question").fill("Opening hours");
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    await chat
      .getByText("We open Monday to Friday, 9 AM to 5 PM WAT.", { exact: true })
      .waitFor({ timeout: 30000 });
    assert.equal(
      await chat
        .getByRole("link", { name: /Talk to a Human on WhatsApp/ })
        .getAttribute("href"),
      "https://wa.me/2348000000000",
    );
    await chat.getByRole("button", { name: "Request human follow-up" }).click();
    await chat.getByLabel("Your name").fill("Test visitor");
    await chat
      .getByLabel("How can the business help?")
      .fill("Please help me set up a business website.");
    await chat.getByRole("checkbox", { name: /I agree to send/ }).check();
    await chat
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await chat
      .getByText(/Your request has been sent/)
      .waitFor({ timeout: 30000 });
    assert.equal(
      (
        await query(
          "SELECT completed FROM chatbot_usage WHERE organization_id=$1",
          [org],
        )
      )[0].completed,
      0,
    );
    await chat.reload();
    await chat
      .getByText("We open Monday to Friday, 9 AM to 5 PM WAT.", { exact: true })
      .waitFor({ timeout: 30000 });
    for (const width of [390, 768, 1440]) {
      await chat.setViewportSize({ width, height: 900 });
      assert.equal(
        await chat.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await chat.screenshot({
        path: "/workspace/exports/chatbot-public-" + width + ".png",
        fullPage: true,
      });
    }
    host = createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><body><h1>External website test</h1><script src="' +
          base +
          '/chatbots/widget.js" data-chatbot-id="' +
          botId +
          '" async></script></body></html>',
      );
    });
    await new Promise((resolve) => host.listen(3156, "0.0.0.0", resolve));
    await query(
      "INSERT INTO chatbot_domains(bot_id,organization_id,hostname,verification_token,verified_at) VALUES($1,$2,'localhost','browser-test',now())",
      [botId, org],
    );
    const embed = await context.newPage();
    const privateBootstrapRequests = [];
    embed.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname.startsWith("/chatbots/widget/")
      )
        privateBootstrapRequests.push(request.url());
    });

    await embed.addInitScript(() => {
      // Third-party iframe storage can be blocked on Safari/privacy-focused browsers.
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new DOMException("Storage blocked");
        },
      });
      const original = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (init) {
        return original.call(this, { ...init, mode: "open" });
      };
    });
    embed.on("pageerror", (e) => errors.push(e.message));
    await embed.goto("http://localhost:3156");
    // Shadow root is intentionally closed: keyboard activation exercises the accessible launcher.
    await embed
      .getByRole("button", { name: "Chat with our AI assistant" })
      .click();
    // Inspect the actual iframe browsing context; production keeps its shadow root closed.
    let embedded;
    for (let i = 0; i < 80 && !embedded; i++) {
      embedded = embed
        .frames()
        .find((f) => f.url().includes("/chatbots/widget/"));
      if (!embedded) await embed.waitForTimeout(250);
    }
    assert.ok(embedded);
    await embedded.getByLabel("Your question").fill("Opening hours");
    await embedded.getByRole("button", { name: "Send", exact: true }).click();
    await embedded
      .getByText("We open Monday to Friday, 9 AM to 5 PM WAT.", { exact: true })
      .waitFor({ timeout: 30000 });
    await embedded.getByRole("button", { name: "Minimize chat" }).click();
    await embed
      .getByRole("button", { name: "Chat with our AI assistant" })
      .click();
    await embedded
      .getByText("We open Monday to Friday, 9 AM to 5 PM WAT.", { exact: true })
      .waitFor();
    await embed.setViewportSize({ width: 390, height: 844 });
    await embed.screenshot({
      path: "/workspace/exports/chatbot-embed-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(privateBootstrapRequests, []);
    const denied = await context.request.post(
      base + "/api/chatbots/" + botId + "/embed",
      { headers: { Origin: "https://unauthorized.example.org" } },
    );
    assert.equal(denied.status(), 403);
    await page.goto(base + "/admin/chatbot");
    await page
      .getByRole("heading", { name: "JKTL AI Chatbot management" })
      .waitFor({ timeout: 30000 });
    await page.getByRole("heading", { name: "Plan entitlements" }).waitFor();
    await page.screenshot({
      path: "/workspace/exports/chatbot-admin-desktop.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        dashboard: "passed",
        publicChat: "passed",
        lead: "passed",
        mobile: "passed",
        externalWidget: "passed",
        unauthorizedOrigin: denied.status(),
        admin: "passed",
        liveAICalls: 0,
      }),
    );
  } catch (error) {
    if (browser) {
      for (const ctx of browser.contexts())
        for (const p of ctx.pages())
          console.error(
            "Failure page:",
            p.url(),
            (await p.locator("body").innerText()).slice(-3000),
          );
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (host) await new Promise((r) => host.close(r));
    // Remove only this run's isolated fixture identities; retain all existing customer data.
    if (botId) {
      await query(
        "DELETE FROM chatbot_notice_outbox WHERE organization_id=$1",
        [org],
      );
      await query("DELETE FROM chatbot_sessions WHERE organization_id=$1", [
        org,
      ]);
      await query("DELETE FROM chatbot_turns WHERE organization_id=$1", [org]);
      await query("DELETE FROM chatbot_tickets WHERE bot_id=$1", [botId]);
      await query("DELETE FROM chatbots WHERE organization_id=$1", [org]);
    }
    for (const table of ["chatbot_usage", "chatbot_audit", "chatbot_org_caps"])
      await query("DELETE FROM " + table + " WHERE organization_id=$1", [org]);
    await query("DELETE FROM organizations WHERE id=$1", [org]);
    await query("DELETE FROM users WHERE id=$1", [user]);
    await query("DELETE FROM admin_users WHERE id=$1", [admin]);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
