import { describe, expect, it } from "vitest";
import {
  canSaveAppResources,
  createEmptyAppResource,
  nextAppResourceKey,
  validateResourceRow,
} from "./appResourceRows";
import { AppResourceKindSlug } from "../types/appResourceKinds";

describe("appResourceRows", () => {
  it("uses SaaS-style KIND_LABELS slugs for default keys", () => {
    expect(nextAppResourceKey(AppResourceKindSlug.Database, [])).toBe(
      "provisioned-lakebase",
    );
    expect(nextAppResourceKey(AppResourceKindSlug.AutoscalingDatabase, [])).toBe(
      "autoscaling-lakebase",
    );
    expect(
      nextAppResourceKey(AppResourceKindSlug.SqlWarehouse, [
        { name: "sql-warehouse", description: "", sql_warehouse: { id: "1", permission: "CAN_USE" } },
      ]),
    ).toBe("sql-warehouse-2");
  });

  it("validates incomplete rows and blocks save", () => {
    const emptySecret = createEmptyAppResource(
      AppResourceKindSlug.Secret,
      "secret",
    );
    expect(validateResourceRow(emptySecret)).toMatch(/secret scope and key/i);
    expect(canSaveAppResources([emptySecret])).toBe(false);

    const complete = {
      ...emptySecret,
      secret: { scope: "svc", key: "token", permission: "READ" as const },
    };
    expect(validateResourceRow(complete)).toBeNull();
    expect(canSaveAppResources([complete])).toBe(true);
  });
});
