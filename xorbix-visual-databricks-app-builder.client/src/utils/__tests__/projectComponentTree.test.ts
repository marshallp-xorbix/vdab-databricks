import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../../models/ProjectComponents";
import {
  getProjectComponentMoveAvailability,
  moveProjectComponent,
  moveProjectComponentBefore,
  removeProjectComponentSubtree,
} from "../projectComponentTree";

function createComponent(
  key: string,
  options: Partial<IProjectComponent> = {},
): IProjectComponent {
  return {
    key,
    type: "Button",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: key,
    description: null,
    properties: { label: key },
    bindings: null,
    children: [],
    layout: null,
    ...options,
  };
}

describe("projectComponentTree", () => {
  it("moves a root component without separating its nested children", () => {
    const components = [
      createComponent("first-root", { children: ["first-child"] }),
      createComponent("first-child"),
      createComponent("second-root"),
    ];

    const reordered = moveProjectComponent(components, "second-root", "up");

    expect(reordered.map((component) => component.key)).toEqual([
      "second-root",
      "first-child",
      "first-root",
    ]);
    expect(
      getProjectComponentMoveAvailability(reordered, "second-root"),
    ).toEqual({
      canMoveUp: false,
      canMoveDown: true,
    });
  });

  it("moves a tab child within its pane and keeps other pane positions stable", () => {
    const components = [
      createComponent("tabs", {
        type: "Tabs",
        properties: { tabs: ["First", "Second"], defaultTabIndex: 0 },
        children: ["first-tab-a", "second-tab-a", "first-tab-b"],
      }),
      createComponent("first-tab-a", {
        layout: { tabIndex: 0, y: 0 },
      }),
      createComponent("second-tab-a", {
        layout: { tabIndex: 1, y: 0 },
      }),
      createComponent("first-tab-b", {
        layout: { tabIndex: 0, y: 1 },
      }),
    ];

    const reordered = moveProjectComponent(components, "first-tab-b", "up");
    const tabs = reordered.find((component) => component.key === "tabs");

    expect(tabs?.children).toEqual([
      "first-tab-b",
      "second-tab-a",
      "first-tab-a",
    ]);
    expect(
      reordered.find((component) => component.key === "first-tab-b")?.layout,
    ).toEqual({ tabIndex: 0, y: 0 });
    expect(
      reordered.find((component) => component.key === "first-tab-a")?.layout,
    ).toEqual({ tabIndex: 0, y: 1 });
    expect(
      reordered.find((component) => component.key === "second-tab-a")?.layout,
    ).toEqual({ tabIndex: 1, y: 0 });
  });

  it("moves a regular layout child by its parent order", () => {
    const components = [
      createComponent("form", {
        type: "Form",
        children: ["first-control", "second-control"],
      }),
      createComponent("first-control"),
      createComponent("second-control"),
    ];

    const reordered = moveProjectComponent(components, "second-control", "up");

    expect(reordered[0]?.children).toEqual(["second-control", "first-control"]);
  });

  it("moves a root component before another root and preserves nested nodes", () => {
    const components = [
      createComponent("first-root", { children: ["first-child"] }),
      createComponent("first-child"),
      createComponent("second-root"),
      createComponent("third-root"),
    ];

    const reordered = moveProjectComponentBefore(
      components,
      "third-root",
      "second-root",
    );

    expect(reordered[0]?.key).toBe("first-root");
    expect(reordered[0]?.children).toEqual(["first-child"]);
    expect(
      reordered
        .filter((component) => component.key !== "first-child")
        .map((component) => component.key),
    ).toEqual(["first-root", "third-root", "second-root"]);
  });

  it("does not move a component across different parents", () => {
    const components = [
      createComponent("first-parent", {
        type: "Form",
        children: ["first-child"],
      }),
      createComponent("second-parent", {
        type: "Form",
        children: ["second-child"],
      }),
      createComponent("first-child"),
      createComponent("second-child"),
    ];

    expect(
      moveProjectComponentBefore(components, "first-child", "second-child"),
    ).toBe(components);
  });

  it("reindexes modal controls after changing their order", () => {
    const components = [
      createComponent("modal", {
        type: "Modal",
        children: ["first-control", "second-control", "third-control"],
      }),
      createComponent("first-control", { layout: { y: 0 } }),
      createComponent("second-control", { layout: { y: 1 } }),
      createComponent("third-control", { layout: { y: 2 } }),
    ];

    const reordered = moveProjectComponent(
      components,
      "second-control",
      "down",
    );

    expect(reordered[0]?.children).toEqual([
      "first-control",
      "third-control",
      "second-control",
    ]);
    expect(
      reordered
        .filter((component) => component.type === "Button")
        .map((component) => [component.key, component.layout?.y]),
    ).toEqual([
      ["first-control", 0],
      ["second-control", 2],
      ["third-control", 1],
    ]);
  });

  it("removes a component subtree and detaches it from the parent", () => {
    const components = [
      createComponent("form", { type: "Form", children: ["expander", "keep"] }),
      createComponent("expander", {
        type: "Expander",
        children: ["nested-button"],
      }),
      createComponent("nested-button"),
      createComponent("keep"),
    ];

    const removal = removeProjectComponentSubtree(components, "expander");

    expect(removal.removedComponents.map((component) => component.key)).toEqual(
      ["expander", "nested-button"],
    );
    expect(removal.components.map((component) => component.key)).toEqual([
      "form",
      "keep",
    ]);
    expect(removal.components[0]?.children).toEqual(["keep"]);
  });
});
