import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const publicDirectory = resolve(import.meta.dirname, "..", ".build", "public");
const indexHtml = await readFile(resolve(publicDirectory, "index.html"), "utf8");
const publicJavaScript = await readPublicJavaScript(publicDirectory);

assert.match(indexHtml, /<script\b[^>]*\bsrc=/i, "Marketplace assets include the client entry point");
assert.ok(publicJavaScript.length > 0, "Marketplace assets include JavaScript bundles");
assert.doesNotMatch(
  publicJavaScript,
  /(?:DATABRICKS_(?:TOKEN|CLIENT_SECRET)|x-forwarded-access-token)\s*[:=]\s*["'][^"']+/i,
  "Marketplace assets do not embed Databricks credentials",
);

process.stdout.write(
  `${JSON.stringify({ event: "app.smoke.marketplace-assets.passed" })}\n`,
);

async function readPublicJavaScript(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const fileContents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) return readPublicJavaScript(entryPath);
      if (!entry.isFile() || !entry.name.endsWith(".js")) return "";
      return readFile(entryPath, "utf8");
    }),
  );
  return fileContents.join("\n");
}
