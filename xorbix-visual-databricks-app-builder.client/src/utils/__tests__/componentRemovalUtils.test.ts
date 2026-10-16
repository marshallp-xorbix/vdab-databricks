import { describe, expect, it } from "vitest";
import type { ComponentContexts } from "../../types/editor";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";
import {
  applyRemoveComponent,
  removeFromContexts,
  updateOrderedChildLayouts,
} from "../componentRemovalUtils";
import {
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
} from "../layoutUtils";
import { createComponent, getComponentById } from "./testingUtils";

describe("componentRemovalUtils", () => {
  it("compacts Form children after removal (Scenario R1)", () => {
    const form = createComponent({
      id: "F",
      type: ComponentType.Form,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["X", "Y"],
    });
    const childX = createComponent({
      id: "X",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const childY = createComponent({
      id: "Y",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [form, childX, childY],
    };

    const { updatedContexts, removedComponent, sourceContextKey } =
      removeFromContexts(contexts, "X");

    const result = applyRemoveComponent(
      "X",
      undefined,
      updatedContexts,
      [],
      new Map(),
      null,
      removedComponent!,
      sourceContextKey!,
      "F",
    );

    const updatedForm = getComponentById(result.nextContexts, "F");
    const updatedY = getComponentById(result.nextContexts, "Y");

    expect(updatedForm?.children).toEqual(["Y"]);
    expect(getLayoutY(updatedY?.layout)).toBe(0);
  });

  it("removes a layout subtree and compacts affected context (Scenario R3)", () => {
    const button = createComponent({
      id: "A",
      type: ComponentType.Button,
      layout: createLayout(0),
    });
    const rows = createComponent({
      id: "L",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      layout: createLayout(1),
      children: ["R1", "R2"],
    });
    const row1 = createComponent({
      id: "R1",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const row2 = createComponent({
      id: "R2",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });
    const button2 = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(2),
    });

    const contexts: ComponentContexts = {
      page_1: [button, rows, row1, row2, button2],
    };

    const { updatedContexts, removedComponent, sourceContextKey } =
      removeFromContexts(contexts, "L");

    const result = applyRemoveComponent(
      "L",
      { mode: "deleteSubtree" },
      updatedContexts,
      [],
      new Map(),
      null,
      removedComponent!,
      sourceContextKey!,
    );

    const remaining = result.nextContexts.page_1;
    expect(remaining.map((component) => component.id)).toEqual(["A", "B"]);
    expect(getLayoutY(remaining[0]?.layout)).toBe(0);
    expect(getLayoutY(remaining[1]?.layout)).toBe(1);
  });

  it("removes a non-layout and compacts affected context", () => {
    const button = createComponent({
      id: "A",
      type: ComponentType.Button,
      layout: createLayout(0),
    });
    const rows = createComponent({
      id: "L",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      layout: createLayout(1),
      children: ["R1", "R2"],
    });
    const row1 = createComponent({
      id: "R1",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const row2 = createComponent({
      id: "R2",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });
    const label = createComponent({
      id: "C",
      type: ComponentType.Label,
      layout: createLayout(2),
    });
    const button2 = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(3),
    });

    const contexts: ComponentContexts = {
      page_1: [button, rows, row1, row2, label, button2],
    };

    const { updatedContexts, removedComponent, sourceContextKey } =
      removeFromContexts(contexts, "C");

    const result = applyRemoveComponent(
      "C",
      undefined,
      updatedContexts,
      [],
      new Map(),
      null,
      removedComponent!,
      sourceContextKey!,
    );

    const remaining = result.nextContexts.page_1;
    expect(remaining.map((component) => component.id)).toEqual([
      "A",
      "L",
      "R1",
      "R2",
      "B",
    ]);
    expect(getLayoutY(remaining[0]?.layout)).toBe(0);
    expect(getLayoutY(remaining[4]?.layout)).toBe(2);
  });

  it("preserves gaps when removing children from Rows/Columns (Scenario R4)", () => {
    const rows = createComponent({
      id: "R",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["R1", "R2"],
    });
    const columns = createComponent({
      id: "L",
      type: ComponentType.Columns,
      category: ComponentCategory.Layout,
      layout: createLayout(1),
      children: ["C1", "C2"],
    });
    const row1 = createComponent({
      id: "R1",
      type: ComponentType.Label,
      layout: createLayout(0),
    });
    const row2 = createComponent({
      id: "R2",
      type: ComponentType.Label,
      layout: createLayout(1),
    });
    const column1 = createComponent({
      id: "C1",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const column2 = createComponent({
      id: "C2",
      type: ComponentType.Dropdown,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [rows, columns, row1, row2, column1, column2],
    };

    const firstRemoval = removeFromContexts(contexts, "C1");
    const afterColumns = applyRemoveComponent(
      "C1",
      undefined,
      firstRemoval.updatedContexts,
      [],
      new Map(),
      null,
      firstRemoval.removedComponent!,
      firstRemoval.sourceContextKey!,
      "L",
    );

    const secondRemoval = removeFromContexts(afterColumns.nextContexts, "R1");
    const afterRows = applyRemoveComponent(
      "R1",
      undefined,
      secondRemoval.updatedContexts,
      [],
      new Map(),
      null,
      secondRemoval.removedComponent!,
      secondRemoval.sourceContextKey!,
      "R",
    );

    const updatedRows = getComponentById(afterRows.nextContexts, "R");
    const updatedColumns = getComponentById(afterRows.nextContexts, "L");
    const updatedRow2 = getComponentById(afterRows.nextContexts, "R2");
    const updatedColumn2 = getComponentById(afterRows.nextContexts, "C2");

    expect(updatedRows?.children).toEqual(["", "R2"]);
    expect(updatedColumns?.children).toEqual(["", "C2"]);
    expect(getLayoutY(updatedRow2?.layout)).toBe(1);
    expect(getLayoutY(updatedColumn2?.layout)).toBe(1);
  });

  it("updateOrderedChildLayouts groups Tabs children by tabIndex and reindexes y per pane (Scenario T1)", () => {
    // Tab 0: A(y=5), B(y=2)  →  after: B→y=0, A→y=1
    // Tab 1: C(y=0.5)        →  after: C→y=0
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["A", "B", "C"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createTabChildLayout(0, 5),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createTabChildLayout(0, 2),
    });
    const childC = createComponent({
      id: "C",
      type: ComponentType.Checkbox,
      layout: createTabChildLayout(1, 0.5),
    });

    const contexts: ComponentContexts = {
      page_1: [tabs, childA, childB, childC],
    };

    const result = updateOrderedChildLayouts(contexts, [], "page_1", tabs);

    const updatedA = getComponentById(result, "A");
    const updatedB = getComponentById(result, "B");
    const updatedC = getComponentById(result, "C");

    // Tab 0: B (y=2) sorts before A (y=5)
    expect(getLayoutY(updatedB?.layout)).toBe(0);
    expect(getLayoutTabIndex(updatedB?.layout)).toBe(0);
    expect(getLayoutY(updatedA?.layout)).toBe(1);
    expect(getLayoutTabIndex(updatedA?.layout)).toBe(0);
    // Tab 1: C is the only child, assigned y=0
    expect(getLayoutY(updatedC?.layout)).toBe(0);
    expect(getLayoutTabIndex(updatedC?.layout)).toBe(1);
  });

  it("updateOrderedChildLayouts reindexes Expander children by y", () => {
    const expander = createComponent({
      id: "E",
      type: ComponentType.Expander,
      category: ComponentCategory.Layout,
      children: ["A", "B", "C"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(3),
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

    const contexts: ComponentContexts = {
      page_1: [expander, childA, childB, childC],
    };

    const result = updateOrderedChildLayouts(contexts, [], "page_1", expander);

    const updatedA = getComponentById(result, "A");
    const updatedB = getComponentById(result, "B");
    const updatedC = getComponentById(result, "C");

    expect(getLayoutY(updatedB?.layout)).toBe(0);
    expect(getLayoutY(updatedC?.layout)).toBe(1);
    expect(getLayoutY(updatedA?.layout)).toBe(2);
  });

  it("removing modal content does not alter page context layouts", () => {
    const pageA = createComponent({
      id: "P1",
      type: ComponentType.Button,
      layout: createLayout(0),
    });
    const pageB = createComponent({
      id: "P2",
      type: ComponentType.TextInput,
      layout: createLayout(1),
    });

    const modal = createComponent({
      id: "M1",
      type: ComponentType.Modal,
      category: ComponentCategory.Layout,
      children: ["MC1", "MC2"],
    });
    const modalChild1 = createComponent({
      id: "MC1",
      type: ComponentType.Label,
      layout: createLayout(0),
    });
    const modalChild2 = createComponent({
      id: "MC2",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [pageA, pageB],
      modal_M1: [modalChild1, modalChild2],
    };

    const { updatedContexts, removedComponent, sourceContextKey } =
      removeFromContexts(contexts, "MC1");

    const result = applyRemoveComponent(
      "MC1",
      undefined,
      updatedContexts,
      [modal],
      new Map(),
      null,
      removedComponent!,
      sourceContextKey!,
      "M1",
    );

    const updatedPageA = getComponentById(result.nextContexts, "P1");
    const updatedPageB = getComponentById(result.nextContexts, "P2");

    expect(getLayoutY(updatedPageA?.layout)).toBe(0);
    expect(getLayoutY(updatedPageB?.layout)).toBe(1);
  });
});
