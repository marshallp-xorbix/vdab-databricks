import { describe, expect, it } from "vitest";

import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import { AppResourceKindSlug } from "../../types/appResourceKinds";
import { buildAppSettingsResourceTableRow } from "../appSettingsResourceRow";

describe("buildAppSettingsResourceTableRow", () => {
  it("maps sql_warehouse kind", () => {
    const resource: NormalizedAppResource = {
      kind: AppResourceKindSlug.SqlWarehouse,
      name: "wh-name",
      description: "",
      sqlWarehouse: { id: "id-1", permission: "CAN_MANAGE" },
    };
    const row = buildAppSettingsResourceTableRow(resource);
    expect(row.key).toBe("wh-name");
    expect(row.typeLabel).toBe("SQL warehouse");
    expect(row.details).toContain("id-1");
    expect(row.permissions).toBe("Can manage");
  });

  it("maps job kind", () => {
    const resource: NormalizedAppResource = {
      kind: AppResourceKindSlug.Job,
      name: "j",
      description: "",
      job: { id: "job-9", permission: "CAN_VIEW" },
    };
    const row = buildAppSettingsResourceTableRow(resource);
    expect(row.typeLabel).toBe("Job");
    expect(row.details).toContain("job-9");
    expect(row.permissions).toBe("Can view");
  });

  it("maps uc_securable kind", () => {
    const resource: NormalizedAppResource = {
      kind: AppResourceKindSlug.UcSecurable,
      name: "uc",
      description: "",
      ucSecurable: {
        securable_full_name: "catalog.schema.vol",
        securable_type: "VOLUME",
        permission: "READ",
      },
    };
    const row = buildAppSettingsResourceTableRow(resource);
    expect(row.typeLabel).toBe("Unity Catalog securable");
    expect(row.details).toContain("catalog.schema.vol");
    expect(row.permissions).toBe("Read");
  });

  it("uses em dash for empty name", () => {
    const resource: NormalizedAppResource = {
      kind: AppResourceKindSlug.Secret,
      name: "   ",
      description: "",
      secret: { key: "k", scope: "s", permission: "READ" },
    };
    const row = buildAppSettingsResourceTableRow(resource);
    expect(row.key).toBe("—");
  });
});
