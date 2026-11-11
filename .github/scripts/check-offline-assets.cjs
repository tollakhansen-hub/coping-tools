// Run with: node .github/scripts/check-offline-assets.cjs
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const root = resolve(__dirname, "../..");
const read = path => readFileSync(resolve(root, path), "utf8");
const { pages, core } = runInNewContext(
  read("sw.js") + "\n({ pages: [...PAGES], core: [...CORE] })",
  { self: { addEventListener() {} } }
);
const cached = new Set(core);
const missing = [];

for (const route of [...pages, "/offline.html"]) {
  const pagePath = route.slice(1) + (route.endsWith("/") ? "index.html" : "");
  const html = read(pagePath);
  for (const [, asset] of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)) {
    if (!cached.has(asset)) missing.push(route + " → " + asset);
  }
}

if (missing.length) {
  console.error("Missing offline assets:\n" + missing.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Offline stylesheets and scripts are listed for " + (pages.length + 1) + " pages.");
}
