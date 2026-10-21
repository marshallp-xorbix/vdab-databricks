import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const packageDirectory = resolve(import.meta.dirname, "..");
const clientDirectory = resolve(
  packageDirectory,
  "..",
  "xorbix-visual-databricks-app-builder.client",
);
const npmCliPath =
  process.env.npm_execpath ??
  resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

execFileSync(process.execPath, [npmCliPath, "run", "build"], {
  cwd: clientDirectory,
  env: {
    ...process.env,
    VITE_VDAB_RUNTIME: "databricks",
  },
  stdio: "inherit",
});
