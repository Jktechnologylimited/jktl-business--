import { fixture, load } from "./fixtures/lifecycle-db.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, readdirSync, readFileSync } from "node:fs";
import { STAGES, lifecycleMessage } from "../src/lib/lifecycle/model.ts";
const f = await fixture();
try {
  const a = await f.account(),
    b = await f.account("DRAFT"),
    c = await f.account("FREE_DOMAIN");
  await f.q("UPDATE email_preferences SET marketing_opt_in=true");
  await f.svc.reconcileLifecycle();
  await f.age(a.id, 15);
  await f.age(b.id, 8);
  await f.age(c.id, 8);
  await f.svc.reconcileLifecycle();
  f.transport.outcome = "unknown";
  await f.svc.dispatchLifecycle();
  await f.q(
    "INSERT INTO renewal_items VALUES('custom:test',$1,$2,current_date-8,-8,'Hosting renewal')",
    [a.id, a.email],
  );
  await f.svc.reconcileLifecycle();
  const dependencies = {
    "@/lib/admin-page-guard": { guardAdminPage: async () => {} },
    "@/lib/custom/service": { query: f.q },
    "@/lib/lifecycle/service": f.svc,
    "@/lib/lifecycle/model": { STAGES, lifecycleMessage },
    "@/lib/actions/lifecycle-actions": f.actions,
    "@/components/distribution/action-form": {
      ActionForm: ({ children, action }) =>
        createElement("form", { "data-action": action.name }, children),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) => createElement("a", props, children),
    },
  };
  let css = "";
  for (const folder of [".next/static/chunks", ".next/static/css"]) {
    try {
      for (const file of readdirSync(folder))
        if (file.endsWith(".css"))
          css += readFileSync(folder + "/" + file, "utf8");
    } catch {}
  }
  for (const [name, path] of [
    ["journey", "emails/automation"],
    ["followups", "support/follow-ups"],
  ]) {
    const page = load(
        "src/app/admin/(command)/" + path + "/page.tsx",
        dependencies,
      ).default,
      html = renderToStaticMarkup(await page());
    writeFileSync(
      "/tmp/jktl-lifecycle-" + name + ".html",
      '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' +
        css +
        '</style></head><body><main style="max-width:1100px;margin:auto;padding:20px"><h1>JKTL Team</h1>' +
        html +
        "</main></body></html>",
    );
  }
  console.log(
    "Rendered authorized team UI fixtures from isolated PostgreSQL data.",
  );
} finally {
  await f.db.close();
}
