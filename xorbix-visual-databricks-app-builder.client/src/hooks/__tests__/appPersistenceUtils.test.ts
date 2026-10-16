import { describe, expect, it } from "vitest";
import { buildComponentSavePayloads } from "../useAppPersistence";
import { validateComponentsForSave } from "../../utils/layoutUtils";
import {
  createLayout,
  createTabChildLayout,
  getLayoutY,
} from "../../utils/layoutUtils";
import { createComponent } from "../../utils/__tests__/testingUtils";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";

describe("appPersistence payloads", () => {
  it("builds layout values correctly before save", () => {
    const rows = createComponent({
      id: "R",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["C1", "C2"],
    });
    const checkbox = createComponent({
      id: "C1",
      type: ComponentType.Checkbox,
      layout: createLayout(0),
    });
    const toggle = createComponent({
      id: "C2",
      type: ComponentType.Toggle,
      layout: createLayout(1),
    });
    const button = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const payloads = buildComponentSavePayloads(
      [rows, checkbox, toggle, button],
      new Map(),
    );

    const rowPayload = payloads.find((payload) => payload.frontendId === "R");
    const checkboxPayload = payloads.find(
      (payload) => payload.frontendId === "C1",
    );
    const togglePayload = payloads.find(
      (payload) => payload.frontendId === "C2",
    );
    const buttonPayload = payloads.find(
      (payload) => payload.frontendId === "B",
    );

    expect(getLayoutY(rowPayload?.request.layout)).toBe(0);
    expect(getLayoutY(buttonPayload?.request.layout)).toBe(1);
    expect(getLayoutY(checkboxPayload?.request.layout)).toBe(0);
    expect(getLayoutY(togglePayload?.request.layout)).toBe(1);

    expect(JSON.parse(rowPayload?.request.children || "[]")).toEqual([
      "C1",
      "C2",
    ]);

    expect(buttonPayload?.request.codeName).toBeUndefined();
  });

  it("includes normalized codeName and frontendId in save payload", () => {
    const button = createComponent({
      id: "B",
      type: ComponentType.Button,
      codeName: "  button1  ",
    });

    const payloads = buildComponentSavePayloads([button], new Map());
    expect(payloads[0].request.codeName).toBe("button1");
    expect(payloads[0].request.frontendId).toBe("B");
  });

  it("blocks save when a Tabs child is missing tabIndex in layout", () => {
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["A"],
    });
    const invalidChild = createComponent({
      id: "A",
      type: ComponentType.Button,
      layout: createLayout(0),
    });

    expect(() => validateComponentsForSave([tabs, invalidChild])).toThrow(
      /Save blocked due to invalid Tabs child layout/i,
    );
  });

  it("allows save when Tabs children include tabIndex and y", () => {
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["A"],
    });
    const validChild = createComponent({
      id: "A",
      type: ComponentType.Button,
      layout: createTabChildLayout(0, 0),
    });

    expect(() => validateComponentsForSave([tabs, validChild])).not.toThrow();
  });

  it("blocks save when line chart Y uses None on a string column", () => {
    const line = createComponent({
      id: "L",
      type: ComponentType.LineChart,
      category: ComponentCategory.Visualization,
      props: {
        yAxis: {
          field: "lob",
          displayName: "Y",
          scaleType: "continuous",
          transform: "none",
        },
      },
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              columns: [{ name: "lob", type: "string" }],
            },
          },
        },
      },
    });

    expect(() => validateComponentsForSave([line])).toThrow(/Y axis/i);
  });

  it("allows save when line chart Y uses COUNT on a string column", () => {
    const line = createComponent({
      id: "L",
      type: ComponentType.LineChart,
      category: ComponentCategory.Visualization,
      props: {
        yAxis: {
          field: "lob",
          displayName: "Y",
          scaleType: "continuous",
          transform: "count",
        },
      },
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              columns: [{ name: "lob", type: "string" }],
            },
          },
        },
      },
    });

    expect(() => validateComponentsForSave([line])).not.toThrow();
  });

  it("blocks save when pie chart Value uses None on a string column", () => {
    const pie = createComponent({
      id: "P",
      type: ComponentType.PieChart,
      category: ComponentCategory.Visualization,
      props: {
        value: {
          field: "region",
          displayName: "Value",
          scaleType: "continuous",
          transform: "none",
        },
      },
      bindings: {
        unityCatalogTable: {
          bindingType: "unityCatalogTable",
          source: {
            kind: "resource",
            resource: {
              columns: [{ name: "region", type: "string" }],
            },
          },
        },
      },
    });

    expect(() => validateComponentsForSave([pie])).toThrow(/Value axis/i);
  });
});
