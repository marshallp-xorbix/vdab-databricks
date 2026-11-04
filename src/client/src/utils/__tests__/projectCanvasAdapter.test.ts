import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../../models/ProjectComponents";
import { ComponentCategory, ComponentType } from "../../types/components/componentTypes";
import { CanvasContextType } from "../../types/editor";
import type { VdabComponent } from "../../types/components/vdabComponent";
import {
  addProjectComponentFromCanvas,
  moveProjectComponentInCanvas,
  toCanvasComponents,
} from "../projectCanvasAdapter";

describe("projectCanvasAdapter", () => {
  it("moves a canvas component in the project tree", () => {
    const components = [
      projectComponent("first", "Button", { y: 0 }),
      projectComponent("second", "Label", { y: 1 }),
    ];
    const canvasComponents = toCanvasComponents(components, []);

    const movedComponents = moveProjectComponentInCanvas(
      components,
      canvasComponents,
      "second",
      { contextKey: "page_1", childIndex: 0 },
      CanvasContextType.Page,
    );

    expect(movedComponents.map((component) => component.key)).toEqual([
      "second",
      "first",
    ]);
    expect(movedComponents[0]?.layout).toBeNull();
    expect(movedComponents[1]?.layout).toBeNull();
  });

  it("persists a component created from the component palette", () => {
    const button: VdabComponent = {
      id: "button-from-palette",
      codeName: "button1",
      type: ComponentType.Button,
      category: ComponentCategory.Controls,
      props: { label: "Submit" },
      children: [],
      schemaVersion: 1,
    };

    const result = addProjectComponentFromCanvas([], button, {
      childIndex: 0,
    });

    expect(result?.component).toMatchObject({
      key: "button-from-palette",
      type: "Button",
      codeName: "button1",
      properties: { label: "Submit" },
      layout: null,
    });
  });

  it.each([
    [ComponentType.GenieChat, "genieSpaceAppResourceName"],
    [ComponentType.ModelChat, "servingEndpointAppResourceName"],
  ])("removes legacy App resource properties when adding %s", (type, legacyProperty) => {
    const canvasComponent: VdabComponent = {
      id: "workspace-chat",
      codeName: "workspaceChat1",
      type,
      category: ComponentCategory.Visualization,
      props: { [legacyProperty]: "legacy-resource", title: "Workspace chat" },
      children: [],
      schemaVersion: 1,
    };

    const result = addProjectComponentFromCanvas([], canvasComponent);

    expect(result?.component.properties).not.toHaveProperty(legacyProperty);
    expect(result?.component.properties.title).toBe("Workspace chat");
  });

  it("adds a retained palette component to a project layout container", () => {
    const components = [projectComponent("form", "Form")];
    const textInput: VdabComponent = {
      id: "nested-input",
      codeName: "textInput1",
      type: ComponentType.TextInput,
      category: ComponentCategory.Controls,
      props: { label: "Name" },
      children: [],
      schemaVersion: 1,
    };

    const result = addProjectComponentFromCanvas(components, textInput, {
      parentId: "form",
      childIndex: 0,
    });

    expect(result?.components.find((component) => component.key === "form")?.children).toEqual([
      "nested-input",
    ]);
    expect(result?.component.layout).toEqual({ y: 0 });
  });

  it("adds and reorders components inside a modal without dropping page components", () => {
    const components = [
      projectComponent("page-button", "Button", { y: 0 }),
      {
        ...projectComponent("modal", "Modal"),
        children: ["modal-first", "modal-second"],
      },
      projectComponent("modal-first", "Button", { y: 0 }),
      projectComponent("modal-second", "Label", { y: 1 }),
    ];
    const extraLabel: VdabComponent = {
      id: "modal-added",
      codeName: "label1",
      type: ComponentType.Label,
      category: ComponentCategory.Controls,
      props: { label: "Added" },
      children: [],
      schemaVersion: 1,
    };

    const added = addProjectComponentFromCanvas(
      components,
      extraLabel,
      undefined,
      CanvasContextType.Modal,
      "modal",
    );
    expect(added?.components.find((component) => component.key === "modal")?.children)
      .toEqual(["modal-first", "modal-second", "modal-added"]);

    const moved = moveProjectComponentInCanvas(
      added?.components ?? components,
      toCanvasComponents(added?.components ?? components, []),
      "modal-second",
      { contextKey: "modal_modal", childIndex: 0 },
      CanvasContextType.Modal,
      "modal",
    );

    expect(moved.map((component) => component.key)).toEqual([
      "page-button",
      "modal",
      "modal-first",
      "modal-second",
      "modal-added",
    ]);
    expect(moved.find((component) => component.key === "modal")?.children).toEqual([
      "modal-second",
      "modal-first",
      "modal-added",
    ]);
  });
});

function projectComponent(
  key: string,
  type: string,
  layout: IProjectComponent["layout"] = null,
): IProjectComponent {
  return {
    key,
    type,
    schemaVersion: 1,
    componentVersion: 1,
    codeName: key,
    description: null,
    properties: {},
    bindings: null,
    children: [],
    layout,
  };
}
