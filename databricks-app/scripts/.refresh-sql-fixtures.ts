import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  appendDataWindowHelpers,
  appendDataWindowReadHelpers,
} from "../server/src/generation/preview-data-window-helpers.ts";

const fixtureDirectory = resolve(import.meta.dirname, "..", "..", ".documentation", "databricks-app-transition", "contracts", "fixtures", "generated");
const fixtureNames = (await readdir(fixtureDirectory)).filter((name) => name.endsWith("-app.py"));
const readHelpers: string[] = [];
const fullHelpers: string[] = [];
appendDataWindowReadHelpers(readHelpers);
appendDataWindowHelpers(fullHelpers);

for (const fixtureName of fixtureNames) {
  const fixturePath = resolve(fixtureDirectory, fixtureName);
  const source = await readFile(fixturePath, "utf8");
  const requestIndex = source.indexOf("def _vdab_sql_request");
  if (requestIndex < 0) continue;
  const existingConstants = [...source.matchAll(/^_VDAB_SQL_MAX_HTTP_RESPONSE_BYTES = [0-9]+$/gm)]
    .find((match) => match.index !== undefined && match.index < requestIndex);
  const helperStart = existingConstants?.index ?? requestIndex;
  const usesFullHelpers = source.includes("def _vdab_sql_validate_primary_key");
  const endPattern = usesFullHelpers
    ? /^[ \t]+raise RuntimeError\('The selected primary key must be unique and non-null across the whole table before saving\.'\)$/m
    : /^[ \t]+return pd\.DataFrame\(rows, columns=column_names\)$/m;
  const endMatch = endPattern.exec(source.slice(helperStart));
  if (endMatch === null) throw new Error(`Could not find SQL helper end in ${fixtureName}.`);
  const helperLines = usesFullHelpers ? fullHelpers : readHelpers;
  const newHelpers = helperLines.join("\n").replace(/^\n/, "").replace(/\n+$/, "");
  const helperEnd = helperStart + endMatch.index + endMatch[0].length;
  await writeFile(fixturePath, `${source.slice(0, helperStart)}${newHelpers}${source.slice(helperEnd)}`, "utf8");
}
