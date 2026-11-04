import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const packageDirectory = resolve(import.meta.dirname, "..");
const clientDirectory = resolve(
  packageDirectory,
  "..",
  "client",
);
const npmCliPath =
  process.env.npm_execpath ??
  resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

execFileSync(process.execPath, [npmCliPath, "run", "build"], {
  cwd: clientDirectory,
  env: process.env,
  stdio: "inherit",
});
