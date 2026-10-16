import { describe, expect, it } from "vitest";
import type { VdabComponent } from "../../types/components";
import {
  ComponentType,
  ComponentCategory,
} from "../../types/components/componentTypes";
import {
  assignLayoutToComponent,
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
  sortComponentsByLayout,
  validateTabsChildLayouts,
} from "../layoutUtils";
import { createComponent } from "./testingUtils";

describe("layoutUtils", () => {
  it("assigns incremental layout for top-level components (Scenario A1)", () => {
    const components: VdabComponent[] = [
      createComponent({
        id: "A",
        type: ComponentType.Button,
        layout: createLayout(0),
      }),
      createComponent({
        id: "B",
        type: ComponentType.TextInput,
        layout: createLayout(1),
      }),
    ];

    const newComponent = createComponent({
      id: "C",
      type: ComponentType.Dropdown,
    });

    const result = assignLayoutToComponent(newComponent, components);
    expect(getLayoutY(result.layout)).toBe(2);
  });

  it("createTabChildLayout encodes tabIndex and y", () => {
    const layout = createTabChildLayout(2, 3);
    expect(JSON.parse(layout)).toEqual({ tabIndex: 2, y: 3 });
  });

  it("getLayoutTabIndex reads tabIndex from layout JSON", () => {
    expect(getLayoutTabIndex('{"tabIndex":1,"y":0}')).toBe(1);
    expect(getLayoutTabIndex('{"y":2}')).toBeUndefined();
    expect(getLayoutTabIndex(undefined)).toBeUndefined();
    expect(getLayoutTabIndex("invalid json")).toBeUndefined();
  });

  it("validateTabsChildLayouts reports missing tabIndex or y for Tabs children", () => {
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["A"],
    });
    const child = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });

    const errors = validateTabsChildLayouts([tabs, child]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/tabIndex and y/i);
  });

  it("validateTabsChildLayouts passes for valid Tabs child layout", () => {
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["A"],
    });
    const child = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createTabChildLayout(0, 0),
    });

    expect(validateTabsChildLayouts([tabs, child])).toEqual([]);
  });

  it("sortComponentsByLayout orders Expander children by layout y", () => {
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(2),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Checkbox,
      layout: createLayout(0),
    });
    const childC = createComponent({
      id: "C",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const sorted = sortComponentsByLayout([childA, childB, childC]);
    expect(sorted.map((component) => component.id)).toEqual(["B", "C", "A"]);
  });
});
