import { describe, expect, it } from "vitest";
import { ComponentType } from "../../types/components/componentTypes";
import {
  deriveComponentOwnershipIndexes,
  getPageComponents,
  getModalChildComponents,
} from "../componentOrganization";
import { createComponent } from "./testingUtils";

describe("componentOrganization ownership indexes", () => {
  it("derives recursive modal ownership and parent indexes", () => {
    const modal = createComponent({
      id: "M",
      type: ComponentType.Modal,
      children: ["F"],
    });
    const form = createComponent({
      id: "F",
      type: ComponentType.Form,
      children: ["A"],
    });
    const childA = createComponent({
      id: "A",
      type: ComponentType.TextInput,
    });
    const pageButton = createComponent({
      id: "B",
      type: ComponentType.Button,
    });

    const indexes = deriveComponentOwnershipIndexes([
      modal,
      form,
      childA,
      pageButton,
    ]);

    expect(indexes.ownerContextByComponentId).toEqual({
      F: "modal_M",
      A: "modal_M",
      B: "page_1",
    });
    expect(indexes.parentByChildId).toEqual({
      F: "M",
      A: "F",
    });

    expect(
      getPageComponents([modal, form, childA, pageButton]).map(
        (component) => component.id,
      ),
    ).toEqual(["B"]);
    expect(
      getModalChildComponents([modal, form, childA, pageButton], "M").map(
        (component) => component.id,
      ),
    ).toEqual(["F", "A"]);
  });

  it("throws when component is owned by multiple modal contexts", () => {
    const modalA = createComponent({
      id: "M1",
      type: ComponentType.Modal,
      children: ["X"],
    });
    const modalB = createComponent({
      id: "M2",
      type: ComponentType.Modal,
      children: ["X"],
    });
    const child = createComponent({
      id: "X",
      type: ComponentType.Button,
    });

    expect(() =>
      deriveComponentOwnershipIndexes([modalA, modalB, child]),
    ).toThrow(/multiple parents/i);
  });

  it("throws when referenced child does not exist", () => {
    const modal = createComponent({
      id: "M",
      type: ComponentType.Modal,
      children: ["missing"],
    });

    expect(() => deriveComponentOwnershipIndexes([modal])).toThrow(
      /missing child reference/i,
    );
  });

  it("throws when cycle introduces multiple parents", () => {
    const modal = createComponent({
      id: "M",
      type: ComponentType.Modal,
      children: ["A"],
    });
    const compA = createComponent({
      id: "A",
      type: ComponentType.Form,
      children: ["B"],
    });
    const compB = createComponent({
      id: "B",
      type: ComponentType.Rows,
      children: ["A"],
    });

    expect(() =>
      deriveComponentOwnershipIndexes([modal, compA, compB]),
    ).toThrow(/multiple parents/i);
  });
});
