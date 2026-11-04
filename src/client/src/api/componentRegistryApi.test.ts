import { afterEach, describe, expect, it, vi } from "vitest";
import { getComponentRegistry } from "./componentRegistryApi";

afterEach(() => vi.unstubAllGlobals());

describe("component registry API", () => {
  it("preserves validated binding schemas from the standalone API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      version: 1,
      components: [],
      bindingSchemas: [{
        type: "unityCatalogTable",
        label: "Unity Catalog Table",
        editorType: "UnityCatalogTableSelector",
        defaultConfig: {
          bindingType: "unityCatalogTable",
          source: { kind: "resource", valueType: "table" },
        },
      }],
    })));

    const registry = await getComponentRegistry();

    expect(registry.bindingSchemas).toEqual([{
      type: "unityCatalogTable",
      label: "Unity Catalog Table",
      editorType: "UnityCatalogTableSelector",
      defaultConfig: {
        bindingType: "unityCatalogTable",
        source: { kind: "resource", valueType: "table" },
      },
    }]);
  });

  it("rejects duplicate binding schema types", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      version: 1,
      components: [],
      bindingSchemas: [
        bindingSchema("unityCatalogTable"),
        bindingSchema("unityCatalogTable"),
      ],
    })));

    await expect(getComponentRegistry()).rejects.toThrow(
      "The component registry returned duplicate binding types.",
    );
  });
});

function bindingSchema(type: string) {
  return {
    type,
    label: "Binding",
    editorType: "TableSelector",
    defaultConfig: {},
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
