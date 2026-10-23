import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import { validateUserApiScopes } from "../src/workspace-app-deployment-validation.ts";

const DOCUMENTED_API_SCOPES = [
  "ai-functions",
  "ai-gateway",
  "apps",
  "files",
  "genie",
  "model-serving",
  "postgres",
  "sql",
  "vector-search",
  "sql:restricted-query",
];
const DOCUMENTED_SDK_SCOPES = [
  "catalog.catalogs",
  "catalog.connections",
  "catalog.schemas",
  "catalog.tables",
  "workspace.workspace",
];
const DOCUMENTED_APP_SPACE_SCOPES = ["mcp.external", "mcp.functions"];

test("ValidateUserApiScopes_AcceptsDocumentedApiSdkAndAppSpaceScopes", () => {
  const readOnlySdkScopes = DOCUMENTED_SDK_SCOPES.map(
    (scope) => `${scope}:read`,
  );

  const scopes = validateUserApiScopes([
    ...DOCUMENTED_API_SCOPES,
    ...DOCUMENTED_SDK_SCOPES,
    ...DOCUMENTED_APP_SPACE_SCOPES,
    ...readOnlySdkScopes,
  ]);

  assert.deepEqual(
    scopes,
    [
      ...DOCUMENTED_API_SCOPES,
      ...DOCUMENTED_SDK_SCOPES,
      ...DOCUMENTED_APP_SPACE_SCOPES,
      ...readOnlySdkScopes,
    ].sort(),
  );
});

test("ValidateUserApiScopes_RejectsUndocumentedOrUnsupportedScopes", () => {
  for (const scope of ["jobs", "unity-catalog", "scim", "identity"]) {
    assert.throws(
      () => validateUserApiScopes([scope]),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "unsupported_child_app_scope",
    );
  }
});
