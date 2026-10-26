// Run from the multi-repository workspace when the shared renderer changes.
import { readFile, writeFile, access } from "node:fs/promises";
const source = await readFile(
  new URL("../src/lib/mail/layout.ts", import.meta.url),
  "utf8",
);
for (const target of [
  "../../jktl-main/lib/mail-layout.ts",
  "../../scaling-waffle-gam-fant-jktl/src/server/mail-layout.ts",
]) {
  const url = new URL(target, import.meta.url);
  try {
    await access(new URL(".", url));
    await writeFile(url, source);
    console.log("Updated " + target);
  } catch {
    console.log("Connected repository not present: " + target);
  }
}
