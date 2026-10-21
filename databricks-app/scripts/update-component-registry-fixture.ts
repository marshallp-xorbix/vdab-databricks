import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ComponentRegistryService } from "../server/src/component-registry/component-registry-service.ts";

const fixturePath = resolve(
  import.meta.dirname,
  "../../.documentation/databricks-app-transition/contracts/fixtures/http-v1/component-definitions-response.json",
);
const registry = new ComponentRegistryService().getRegistry();

await writeFile(fixturePath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
process.stdout.write(`Updated ${fixturePath}\n`);
