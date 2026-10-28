import { describe, expect, it } from "vitest";
import type { IComponentRegistry } from "../../models/ComponentRegistry";
import { toLegacyComponentRegistry } from "../projectComponentRegistryAdapter";

describe("project component registry adapter", () => {
  it("carries binding schemas into the retained SaaS properties panel contract", () => {
    const registry: IComponentRegistry = {
      version: 1,
      components: [],
      bindingSchemas: [{
        type: "lakebaseAutoscaling",
        label: "Lakebase Autoscaling",
        editorType: "LakebaseAutoscalingTableSelector",
        defaultConfig: {
          bindingType: "lakebaseAutoscaling",
          source: {
            kind: "resource",
            valueType: "table",
          },
        },
      }],
    };

    expect(toLegacyComponentRegistry(registry).bindingSchemas).toEqual(
      registry.bindingSchemas,
    );
  });
});
