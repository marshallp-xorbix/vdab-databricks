import { expect, it } from "vitest";
import {
  buildAutoscalingPostgresBranchPath,
  buildAutoscalingPostgresDatabasePath,
  parseAutoscalingPostgresDatabasePath,
} from "./appResourcePostgresPath";

it("AppResourcePostgresPath_RoundTripsValidWirePath", () => {
  const path = buildAutoscalingPostgresDatabasePath(
    "project-one",
    "branch-one",
    "database-one",
  );
  expect(path).toBe(
    "projects/project-one/branches/branch-one/databases/database-one",
  );
  expect(parseAutoscalingPostgresDatabasePath(path)).toEqual({
    projectId: "project-one",
    branchId: "branch-one",
    databaseId: "database-one",
  });
  expect(buildAutoscalingPostgresBranchPath("project-one", "branch-one")).toBe(
    "projects/project-one/branches/branch-one",
  );
});

it("AppResourcePostgresPath_RejectsFreeFormNames", () => {
  expect(parseAutoscalingPostgresDatabasePath("databricks_postgres")).toBeNull();
  expect(parseAutoscalingPostgresDatabasePath("")).toBeNull();
});
