import { readdir, readFile } from "node:fs/promises";

const GENERATED_FIXTURE_DIRECTORY = new URL(
  "../../../.documentation/databricks-app-transition/contracts/fixtures/generated/",
  import.meta.url,
);

/**
 * Reads a complete generated Python golden file, including snapshots split into
 * ordered text fragments to keep each checked-in file focused and manageable.
 */
export async function readGeneratedPythonFixture(
  fixtureName: string,
): Promise<string> {
  if (!/^[a-z0-9-]+\.py$/.test(fixtureName)) {
    throw new Error("Generated Python fixture name is invalid.");
  }

  const fixtureUrl = new URL(fixtureName, GENERATED_FIXTURE_DIRECTORY);
  try {
    return await readFile(fixtureUrl, "utf8");
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  const fixtureStem = fixtureName.slice(0, -".py".length);
  const fragmentsUrl = new URL(
    `parts/${fixtureStem}/`,
    GENERATED_FIXTURE_DIRECTORY,
  );
  const fragmentNames = (await readdir(fragmentsUrl))
    .filter((name) => /^\d{3}\.txt$/.test(name))
    .sort();
  if (fragmentNames.length === 0) {
    throw new Error(`Generated Python fixture ${fixtureName} was not found.`);
  }

  const fragments = await Promise.all(
    fragmentNames.map((name) => readFile(new URL(name, fragmentsUrl), "utf8")),
  );
  return fragments.join("");
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
