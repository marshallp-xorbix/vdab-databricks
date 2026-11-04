import { describe, expect, it } from "vitest";
import { ComponentType } from "../../../types/components/componentTypes";
import type { VdabComponent } from "../../../types/components";
import { resolveBindingColumns } from "../resolveBindingColumns";

function makeComponent(
  bindings: VdabComponent["bindings"],
): VdabComponent {
  return {
    id: "c1",
    codeName: "amoeba1",
    type: ComponentType.AmoebaStory,
    category: "Visualization",
    props: {},
    bindings,
  } as VdabComponent;
}

describe("resolveBindingColumns", () => {
  it("reads columns from lakebaseAutoscaling.source.resource", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        lakebaseAutoscaling: {
          bindingType: "lakebaseAutoscaling",
          source: {
            kind: "resource",
            resource: {
              type: "lakebaseAutoscaling",
              columns: [
                { name: "customer_id", type: "string" },
                { name: "revenue", type: "double" },
              ],
            },
          },
        },
      }),
    );

    expect(columns.map((c) => c.name)).toEqual(["customer_id", "revenue"]);
  });

  it("reads columns from lakebaseProvisionedDatabase.source.resource", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        lakebaseProvisionedDatabase: {
          bindingType: "lakebaseProvisionedDatabase",
          source: {
            kind: "resource",
            resource: {
              type: "lakebaseProvisionedDatabase",
              columns: [{ name: "region", type: "string" }],
            },
          },
        },
      }),
    );

    expect(columns.map((c) => c.name)).toEqual(["region"]);
  });

  it("reads columns from unityCatalogTable.source.resource", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              type: "unityCatalogTable",
              columns: [{ name: "id", type: "long" }],
            },
          },
        },
      }),
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].name).toBe("id");
  });

  it("prefers lakebaseAutoscaling when multiple bindings have columns", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        lakebaseAutoscaling: {
          bindingType: "lakebaseAutoscaling",
          source: {
            kind: "resource",
            resource: {
              type: "lakebaseAutoscaling",
              columns: [{ name: "auto_col", type: "string" }],
            },
          },
        },
        lakebaseProvisionedDatabase: {
          bindingType: "lakebaseProvisionedDatabase",
          source: {
            kind: "resource",
            resource: {
              type: "lakebaseProvisionedDatabase",
              columns: [{ name: "prov_col", type: "string" }],
            },
          },
        },
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              type: "unityCatalogTable",
              columns: [{ name: "uc_col", type: "string" }],
            },
          },
        },
      }),
    );

    expect(columns.map((c) => c.name)).toEqual(["auto_col"]);
  });

  it("returns empty when bindings are undefined", () => {
    expect(resolveBindingColumns(makeComponent(undefined))).toEqual([]);
  });

  it("returns empty when binding has no columns", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        lakebaseAutoscaling: {
          bindingType: "lakebaseAutoscaling",
          source: {
            kind: "resource",
            resource: {
              type: "lakebaseAutoscaling",
              schema: "dbdemos",
              table: "amoeba_story",
            },
          },
        },
      }),
    );

    expect(columns).toEqual([]);
  });

  it("filters null and primitive column entries", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              type: "unityCatalogTable",
              columns: [
                null,
                "bad",
                { name: "ok", type: "string" },
              ] as unknown as { name: string; type: string }[],
            },
          },
        },
      }),
    );

    expect(columns.map((c) => c.name)).toEqual(["ok"]);
  });

  it("falls back to legacy config.columns", () => {
    const columns = resolveBindingColumns(
      makeComponent({
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              type: "unityCatalogTable",
            },
          },
          config: {
            columns: [{ name: "legacy_col", type: "string" }],
          },
        } as never,
      }),
    );

    expect(columns.map((c) => c.name)).toEqual(["legacy_col"]);
  });
});
