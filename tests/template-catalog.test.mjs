import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as catalog from "../src/lib/website-templates.ts";
const require = createRequire(import.meta.url);
function load() {
  const module = { exports: {} };
  const dependencies = {
    react: require("react"),
    "framer-motion": require("framer-motion"),
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) => createElement("a", props, children),
    },
    "lucide-react": require("lucide-react"),
    "@/lib/website-templates": catalog,
    "@/components/i18n/LanguageProvider": {
      T: ({ children }) => children,
      useLanguage: () => ({ t: (value) => value }),
    },
    "./TemplateGallery.module.css": {
      __esModule: true,
      default: new Proxy({}, { get: (_, key) => String(key) }),
    },
  };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(
      readFileSync(
        new URL(
          "../src/components/templates/TemplateGallery.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText,
  )(
    (name) => {
      if (name in dependencies) return dependencies[name];
      throw Error(name);
    },
    module,
    module.exports,
  );
  return module.exports.TemplateGallery;
}
const Gallery = load();
test("public catalog uses existing preview routes and sign-in only for editing; customer catalog keeps the direct editor path", () => {
  for (const insideBusiness of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(Gallery, { insideBusiness }),
    );
    assert.equal((html.match(/<article/g) || []).length, 24);
    assert.match(html, /href="\/templates\/law-firm"/);
    assert.ok(
      html.includes(
        insideBusiness
          ? "/business/website/template?template=law-firm"
          : "https://business.jktl.com.ng/login?template=law-firm",
      ),
    );
    assert.ok(!html.includes("Picture your business here"));
    assert.ok(
      html.indexOf("Law Firm</") < html.indexOf("Church &amp; Ministry</"),
    );
    assert.match(html, /aria-label="Template information"/);
    assert.match(html, /204/);
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  }
});
test("blank filter shows both existing blank starting points and the matched Main catalog uses the same source/styles", (t) => {
  const html = renderToStaticMarkup(
    createElement(Gallery, { initialType: "blank" }),
  );
  assert.equal((html.match(/<article/g) || []).length, 2);
  assert.match(html, /\/templates\/blank-website/);
  assert.match(html, /\/templates\/blank-landing/);
  const main = new URL("../../jktl-main/", import.meta.url);
  if (!existsSync(main)) return t.skip("Optional paired checkout");
  for (const file of ["TemplateGallery.tsx", "TemplateGallery.module.css"])
    assert.equal(
      readFileSync(
        new URL("../src/components/templates/" + file, import.meta.url),
        "utf8",
      ),
      readFileSync(new URL("components/templates/" + file, main), "utf8"),
    );
});
