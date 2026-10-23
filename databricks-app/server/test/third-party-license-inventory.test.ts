import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPackageLicenseInventory,
  renderPackageLicenseInventory,
} from "../../scripts/third-party-license-inventory.ts";

test("CollectPackageLicenseInventory_HandlesScopedAndNestedPackages", () => {
  const lockfile = {
    packages: {
      "": { name: "vdab" },
      "node_modules/@scope/widget": { version: "1.2.3", license: "MIT" },
      "node_modules/root/node_modules/@scope/widget": {
        version: "1.2.3",
        license: { type: "MIT" },
      },
      "node_modules/root/node_modules/nested": {
        version: "4.5.6",
        license: "Apache-2.0",
      },
      "node_modules/unknown-license": { version: "0.1.0" },
    },
  };

  const inventory = collectPackageLicenseInventory("test lock", lockfile);

  assert.deepEqual(inventory, [
    {
      source: "test lock",
      packageName: "@scope/widget",
      version: "1.2.3",
      license: "MIT",
    },
    {
      source: "test lock",
      packageName: "nested",
      version: "4.5.6",
      license: "Apache-2.0",
    },
    {
      source: "test lock",
      packageName: "unknown-license",
      version: "0.1.0",
      license: "UNDECLARED",
    },
  ]);
});

test("CollectPackageLicenseInventory_InvalidLockfile_Throws", () => {
  assert.throws(
    () => collectPackageLicenseInventory("broken lock", { packages: null }),
    /Expected npm lockfile packages to be an object\./,
  );
});

test("RenderPackageLicenseInventory_EscapesTableCellsAndMarksLimitations", () => {
  const inventory = renderPackageLicenseInventory([
    {
      source: "client | build",
      packageName: "license\nparser",
      version: "1.0.0",
      license: "MIT | Apache-2.0",
    },
  ]);

  assert.match(inventory, /client \\\| build/);
  assert.match(inventory, /license parser/);
  assert.match(inventory, /not legal approval, a complete third-party notice/);
  assert.match(inventory, /`asyncpg` \| `0\.32\.0` \| Apache-2\.0/);
});
