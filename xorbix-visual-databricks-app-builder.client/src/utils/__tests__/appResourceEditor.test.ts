import { describe, expect, it } from "vitest";
import { AppResourceKindSlug } from "../../types/appResourceKinds";
import {
  findDuplicateNameKeys,
  nextAvailableDefaultResourceKey,
  slugifyResourceTypeLabel,
  validateResourceRow,
  type StagedResourceRow,
} from "../appResourceEditor";

describe("findDuplicateNameKeys", () => {
  it("detects duplicate trimmed keys", () => {
    const rows: StagedResourceRow[] = [
      {
        clientId: "a",
        resource: {
          kind: AppResourceKindSlug.Job,
          name: "same",
          job: { id: "1", permission: "CAN_VIEW" },
        },
      },
      {
        clientId: "b",
        resource: {
          kind: AppResourceKindSlug.Job,
          name: "same",
          job: { id: "2", permission: "CAN_VIEW" },
        },
      },
    ];
    const dups = findDuplicateNameKeys(rows);
    expect(dups.has("same")).toBe(true);
  });
});

describe("slugifyResourceTypeLabel", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugifyResourceTypeLabel("SQL warehouse")).toBe("sql-warehouse");
    expect(slugifyResourceTypeLabel("  Unity Catalog securable  ")).toBe(
      "unity-catalog-securable",
    );
  });
});

describe("nextAvailableDefaultResourceKey", () => {
  it("uses slug from kind label when unused", () => {
    expect(
      nextAvailableDefaultResourceKey(AppResourceKindSlug.SqlWarehouse, []),
    ).toBe(
      "sql-warehouse",
    );
  });

  it("appends -2 when base key is taken", () => {
    expect(
      nextAvailableDefaultResourceKey(AppResourceKindSlug.SqlWarehouse, [
        "sql-warehouse",
      ]),
    ).toBe("sql-warehouse-2");
  });

  it("increments suffix until free", () => {
    expect(
      nextAvailableDefaultResourceKey(AppResourceKindSlug.SqlWarehouse, [
        "sql-warehouse",
        "sql-warehouse-2",
      ]),
    ).toBe("sql-warehouse-3");
  });

  it("treats any existing name as reserved (global uniqueness)", () => {
    expect(
      nextAvailableDefaultResourceKey(AppResourceKindSlug.Job, ["sql-warehouse"]),
    ).toBe("job");
    expect(
      nextAvailableDefaultResourceKey(AppResourceKindSlug.SqlWarehouse, ["job"]),
    ).toBe("sql-warehouse");
  });
});

describe("validateResourceRow", () => {
  it("returns error when key missing", () => {
    const msg = validateResourceRow({
      kind: AppResourceKindSlug.Job,
      name: "  ",
      job: { id: "1", permission: "CAN_VIEW" },
    });
    expect(msg).toContain("Resource key");
  });

  it("returns null for valid job row", () => {
    const msg = validateResourceRow({
      kind: AppResourceKindSlug.Job,
      name: "r1",
      job: { id: "10", permission: "CAN_VIEW" },
    });
    expect(msg).toBeNull();
  });

  it("describes database row as catalog selection when database_name empty", () => {
    const msg = validateResourceRow({
      kind: AppResourceKindSlug.Database,
      name: "db1",
      database: {
        database_name: "",
        instance_name: "",
        permission: "CAN_USE",
      },
    });
    expect(msg).toContain("Lakebase database instance");
  });
});
