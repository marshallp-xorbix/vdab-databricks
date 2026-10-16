import { describe, expect, it } from "vitest";
import type { ComponentContexts } from "../../types/editor";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";
import { moveComponentInContexts } from "../componentMoveUtils";
import {
  createLayout,
  createTabChildLayout,
  getLayoutTabIndex,
  getLayoutY,
} from "../layoutUtils";
import { createComponent, getComponentById } from "./testingUtils";

describe("componentMoveUtils", () => {
  it("reorders form children by target index and compacts layout", () => {
    const form = createComponent({
      id: "F",
      type: ComponentType.Form,
      category: ComponentCategory.Layout,
      children: ["A", "B", "C"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });
    const childC = createComponent({
      id: "C",
      type: ComponentType.Button,
      layout: createLayout(2),
    });

    const contexts: ComponentContexts = {
      page_1: [form, childA, childB, childC],
    };

    const result = moveComponentInContexts(
      "A",
      contexts,
      [],
      { contextKey: "page_1", parentId: "F" },
      { contextKey: "page_1", parentId: "F" },
      null,
      new Map(),
    );

    const updatedForm = getComponentById(result.nextContexts, "F");
    const updatedA = getComponentById(result.nextContexts, "A");
    const updatedB = getComponentById(result.nextContexts, "B");
    const updatedC = getComponentById(result.nextContexts, "C");

    expect(updatedForm?.children).toEqual(["B", "C", "A"]);
    expect(getLayoutY(updatedB?.layout)).toBe(0);
    expect(getLayoutY(updatedC?.layout)).toBe(1);
    expect(getLayoutY(updatedA?.layout)).toBe(2);
  });

  it("moves a child to canvas end and preserves Rows gaps", () => {
    const rows = createComponent({
      id: "L",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
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
    const button = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [rows, row1, row2, button],
    };

    const result = moveComponentInContexts(
      "R1",
      contexts,
      [],
      { contextKey: "page_1", parentId: "L" },
      { contextKey: "page_1" },
      null,
      new Map(),
    );

    const updatedRows = getComponentById(result.nextContexts, "L");
    const updatedRow2 = getComponentById(result.nextContexts, "R2");
    const movedRow1 = getComponentById(result.nextContexts, "R1");

    expect(updatedRows?.children).toEqual(["", "R2"]);
    expect(getLayoutY(updatedRow2?.layout)).toBe(1);
    expect(getLayoutY(movedRow1?.layout)).toBe(2);
  });

  it("attempting to insert into occupied Rows slot removes source but does not insert into target", () => {
    const rows = createComponent({
      id: "L",
      type: ComponentType.Rows,
      category: ComponentCategory.Layout,
      children: ["X"],
    });
    const rowX = createComponent({
      id: "X",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const rowY = createComponent({
      id: "Y",
      type: ComponentType.Button,
      layout: createLayout(2),
    });

    const contexts: ComponentContexts = {
      page_1: [rows, rowX, rowY],
    };

    const originalClone = JSON.stringify(contexts);

    const result = moveComponentInContexts(
      "Y",
      contexts,
      [],
      { contextKey: "page_1" },
      { contextKey: "page_1", parentId: "L", childIndex: 0 },
      null,
      new Map(),
    );

    const updatedRows = getComponentById(result.nextContexts, "L");
    const updatedX = getComponentById(result.nextContexts, "X");

    // parent children unchanged because slot 0 is occupied
    expect(updatedRows?.children).toEqual(["X"]);
    // original occupant still present with same layout
    expect(updatedX).toBeDefined();
    expect(getLayoutY(updatedX?.layout)).toBe(0);
    // moved component remains in its original location/layout (no drop into occupied slot)
    const movedYAfter = getComponentById(result.nextContexts, "Y");
    expect(movedYAfter).toBeDefined();
    expect(getLayoutY(movedYAfter?.layout)).toBe(2);
    // ensure the function reverted to the original contexts object
    expect(result.nextContexts).toBe(contexts);
    expect(JSON.stringify(contexts)).toBe(originalClone);
  });

  it("moves a component within a modal and updates modal children and layouts", () => {
    const modal = createComponent({
      id: "M",
      type: ComponentType.Modal,
      category: ComponentCategory.Layout,
      children: ["A", "B"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      [`modal_${modal.id}`]: [childA, childB],
    };

    const modals = [modal];

    const result = moveComponentInContexts(
      "A",
      contexts,
      modals,
      { contextKey: `modal_${modal.id}`, parentId: modal.id },
      { contextKey: `modal_${modal.id}` },
      null,
      new Map(),
    );

    const updatedModal = result.nextModals.find((m) => m.id === "M");
    const updatedA = getComponentById(result.nextContexts, "A");
    const updatedB = getComponentById(result.nextContexts, "B");

    expect(updatedModal?.children).toEqual(["B", "A"]);
    expect(getLayoutY(updatedB?.layout)).toBe(0);
    expect(getLayoutY(updatedA?.layout)).toBe(1);
  });

  it("inserts a component into the middle of a Form inside a modal and compacts layouts", () => {
    const modal = createComponent({
      id: "M2",
      type: ComponentType.Modal,
      category: ComponentCategory.Layout,
      children: ["F"],
    });
    const form = createComponent({
      id: "F",
      type: ComponentType.Form,
      category: ComponentCategory.Layout,
      children: ["A", "B"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });
    const toMove = createComponent({
      id: "X",
      type: ComponentType.Checkbox,
      layout: createLayout(2),
    });

    const contexts: ComponentContexts = {
      [`modal_${modal.id}`]: [form, childA, childB, toMove],
    };

    const modals = [modal];

    const result = moveComponentInContexts(
      "X",
      contexts,
      modals,
      { contextKey: `modal_${modal.id}` },
      { contextKey: `modal_${modal.id}`, parentId: "F", childIndex: 1 },
      null,
      new Map(),
    );

    const updatedForm = getComponentById(result.nextContexts, "F");
    const updatedA = getComponentById(result.nextContexts, "A");
    const updatedB = getComponentById(result.nextContexts, "B");
    const updatedX = getComponentById(result.nextContexts, "X");
    const updatedModal = result.nextModals.find((m) => m.id === "M2");

    // Form children array is unordered membership — layout y is the canonical order.
    // The assertions on getLayoutY below are the true ordering verification.
    expect(updatedForm?.children).toEqual(
      expect.arrayContaining(["A", "X", "B"]),
    );
    expect(updatedForm?.children).toHaveLength(3);
    expect(getLayoutY(updatedA?.layout)).toBe(0);
    expect(getLayoutY(updatedX?.layout)).toBe(1);
    expect(getLayoutY(updatedB?.layout)).toBe(2);
    // ensure there is exactly one entry for X in the modal context
    expect(
      result.nextContexts[`modal_${modal.id}`].filter((c) => c.id === "X")
        .length,
    ).toBe(1);
    // modal component still references the form
    expect(updatedModal?.children).toEqual(["F"]);
  });

  it("moving a non-existent component returns original contexts unchanged and keeps same reference", () => {
    const comp = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const contexts: ComponentContexts = { page_1: [comp] };
    const contextsClone = JSON.stringify(contexts);

    const result = moveComponentInContexts(
      "NON_EXISTENT",
      contexts,
      [],
      { contextKey: "page_1" },
      { contextKey: "page_1" },
      null,
      new Map(),
    );

    // function returns the same reference for unchanged contexts
    expect(result.nextContexts).toBe(contexts);
    // original contexts object not mutated
    expect(JSON.stringify(contexts)).toBe(contextsClone);
  });

  it("moves a child into an Expander at target index and compacts y-order", () => {
    const expander = createComponent({
      id: "E",
      type: ComponentType.Expander,
      category: ComponentCategory.Layout,
      children: ["A", "B"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createLayout(0),
    });
    const childB = createComponent({
      id: "B",
      type: ComponentType.Checkbox,
      layout: createLayout(1),
    });
    const toMove = createComponent({
      id: "X",
      type: ComponentType.Button,
      layout: createLayout(2),
    });

    const contexts: ComponentContexts = {
      page_1: [expander, childA, childB, toMove],
    };

    const result = moveComponentInContexts(
      "X",
      contexts,
      [],
      { contextKey: "page_1" },
      { contextKey: "page_1", parentId: "E", childIndex: 1 },
      null,
      new Map(),
    );

    const updatedExpander = getComponentById(result.nextContexts, "E");
    const updatedA = getComponentById(result.nextContexts, "A");
    const updatedB = getComponentById(result.nextContexts, "B");
    const updatedX = getComponentById(result.nextContexts, "X");

    expect(updatedExpander?.children).toEqual(
      expect.arrayContaining(["A", "X", "B"]),
    );
    expect(updatedExpander?.children).toHaveLength(3);
    expect(getLayoutY(updatedA?.layout)).toBe(0);
    expect(getLayoutY(updatedX?.layout)).toBe(1);
    expect(getLayoutY(updatedB?.layout)).toBe(2);
  });

  it("moves a component into a Tabs pane and assigns correct tabIndex and y layout", () => {
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["A"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
      layout: createTabChildLayout(0, 0), // already in tab 0
    });
    const toMove = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [tabs, childA, toMove],
    };

    const result = moveComponentInContexts(
      "B",
      contexts,
      [],
      { contextKey: "page_1" },
      { contextKey: "page_1", parentId: "T", childIndex: 1, tabIndex: 0 },
      null,
      new Map(),
    );

    const updatedTabs = getComponentById(result.nextContexts, "T");
    const updatedA = getComponentById(result.nextContexts, "A");
    const movedB = getComponentById(result.nextContexts, "B");

    // T.children is unordered membership — layout y is the canonical ordering
    expect(updatedTabs?.children).toEqual(expect.arrayContaining(["A", "B"]));
    expect(updatedTabs?.children).toHaveLength(2);
    // A stays at y=0 in tab 0
    expect(getLayoutY(updatedA?.layout)).toBe(0);
    expect(getLayoutTabIndex(updatedA?.layout)).toBe(0);
    // B inserted at childIndex=1 in tab 0 — normalised to y=1
    expect(getLayoutY(movedB?.layout)).toBe(1);
    expect(getLayoutTabIndex(movedB?.layout)).toBe(0);
  });

  it("moving the Tabs container itself preserves tabIndex on its children (regression: tabIndex was stripped by compactTopLevelLayouts)", () => {
    // D is a child of T assigned to tab 1. Moving T should not strip D's tabIndex.
    const tabs = createComponent({
      id: "T",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["D"],
    });
    const dataWindow = createComponent({
      id: "D",
      type: ComponentType.DataWindow,
      layout: createTabChildLayout(1, 0), // in tab 1
    });
    const button = createComponent({
      id: "B",
      type: ComponentType.Button,
      layout: createLayout(1),
    });

    const contexts: ComponentContexts = {
      page_1: [tabs, dataWindow, button],
    };

    // Move T back to the same top-level position (simulates drag-and-drop to same spot)
    const result = moveComponentInContexts(
      "T",
      contexts,
      [],
      { contextKey: "page_1" },
      { contextKey: "page_1", childIndex: 0 },
      null,
      new Map(),
    );

    const updatedD = getComponentById(result.nextContexts, "D");

    // tabIndex must survive the Tabs container being temporarily removed
    expect(getLayoutTabIndex(updatedD?.layout)).toBe(1);
    expect(getLayoutY(updatedD?.layout)).toBe(0);
  });

  it("moving Tabs on page context does not mutate modal child layout", () => {
    const pageTabs = createComponent({
      id: "T_PAGE",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      layout: createLayout(0),
      children: ["P_CHILD"],
    });
    const pageChild = createComponent({
      id: "P_CHILD",
      type: ComponentType.Button,
      layout: createTabChildLayout(0, 0),
    });
    const pageButton = createComponent({
      id: "P_BTN",
      type: ComponentType.TextInput,
      layout: createLayout(1),
    });

    const modal = createComponent({
      id: "M1",
      type: ComponentType.Modal,
      category: ComponentCategory.Layout,
      children: ["M_TAB"],
    });
    const modalTabs = createComponent({
      id: "M_TAB",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      children: ["M_CHILD"],
      layout: createLayout(0),
    });
    const modalChild = createComponent({
      id: "M_CHILD",
      type: ComponentType.Checkbox,
      layout: createTabChildLayout(2, 3),
    });

    const contexts: ComponentContexts = {
      page_1: [pageTabs, pageChild, pageButton],
      modal_M1: [modalTabs, modalChild],
    };

    const result = moveComponentInContexts(
      "T_PAGE",
      contexts,
      [modal],
      { contextKey: "page_1" },
      { contextKey: "page_1", childIndex: 1 },
      null,
      new Map(),
    );

    const updatedModalChild = getComponentById(result.nextContexts, "M_CHILD");
    expect(getLayoutTabIndex(updatedModalChild?.layout)).toBe(2);
    expect(getLayoutY(updatedModalChild?.layout)).toBe(3);
  });
});
