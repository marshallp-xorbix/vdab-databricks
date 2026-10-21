import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { readProjectCustomModulesInput } from "../src/db/project-custom-modules-input.ts";

test("ProjectCustomModulesInput_AcceptsVersionedPythonSource", () => {
  const source = "def normalize_order(ctx):\n    return {'ok': True}\n";
  assert.deepEqual(readProjectCustomModulesInput({ expectedVersion: 4, source }), {
    expectedVersion: 4,
    source,
  });
});

test("ProjectCustomModulesInput_RejectsAuthorityAndOversizedFields", () => {
  assert.throws(
    () => readProjectCustomModulesInput({ expectedVersion: 1, source: "", workspaceHost: "https://evil.invalid" }),
    (error: unknown) => error instanceof ApplicationError && error.code === "invalid_custom_modules",
  );
  assert.throws(
    () => readProjectCustomModulesInput({ expectedVersion: 1, source: "x".repeat(256_001) }),
    (error: unknown) => error instanceof ApplicationError && error.status === 400,
  );
});

test("ProjectCustomModulesInput_RejectsLiteralCredentialValues", () => {
  for (const source of [
    "API_KEY = 'this-is-a-secret-value'",
    "# Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
    `token = "dapi${"a".repeat(32)}"`,
  ]) {
    assert.throws(
      () => readProjectCustomModulesInput({ expectedVersion: 1, source }),
      (error: unknown) => error instanceof ApplicationError && error.code === "custom_modules_secret_detected",
    );
  }
});
