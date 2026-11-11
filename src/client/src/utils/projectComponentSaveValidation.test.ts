import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../models/ProjectComponents";
import { validateProjectComponentsForSave } from "./projectComponentSaveValidation";

function component(
  partial: Partial<IProjectComponent> & Pick<IProjectComponent, "key" | "type">,
): IProjectComponent {
  return {
    schemaVersion: 1,
    componentVersion: 1,
    codeName: partial.key,
    description: null,
    properties: {},
    bindings: null,
    children: [],
    layout: null,
    ...partial,
  };
}

describe("validateProjectComponentsForSave", () => {
  it("blocks Columns that exceed slot count", () => {
    expect(() =>
      validateProjectComponentsForSave([
        component({
          key: "cols",
          type: "Columns",
          properties: { columnCount: 1 },
          children: ["a", "b"],
        }),
        component({ key: "a", type: "Label" }),
        component({ key: "b", type: "Label" }),
      ]),
    ).toThrow(/Columns/);
  });

  it("blocks Form children outside the allow-list", () => {
    expect(() =>
      validateProjectComponentsForSave([
        component({
          key: "form",
          type: "Form",
          children: ["button"],
        }),
        component({ key: "button", type: "Button" }),
      ]),
    ).toThrow(/Form/);
  });

  it("allows Modal children that the server allow-list accepts", () => {
    expect(() =>
      validateProjectComponentsForSave([
        component({
          key: "modal",
          type: "Modal",
          children: ["chart"],
        }),
        component({ key: "chart", type: "BarChart" }),
      ]),
    ).not.toThrow();
  });
});
