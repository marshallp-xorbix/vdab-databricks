import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../../models/ProjectComponents";
import { appendProjectComponentToContainer } from "../projectCanvasDrop";

describe("appendProjectComponentToContainer", () => {
  it("adds an allowed child to a compatible layout container", () => {
    const components = [createComponent("columns", "Columns")];

    const updated = appendProjectComponentToContainer(
      components,
      "columns",
      "Button",
    );

    expect(updated).not.toBeNull();
    expect(updated?.[0]?.children).toHaveLength(1);
    expect(updated?.[1]).toMatchObject({
      type: "Button",
      key: updated?.[0]?.children[0],
    });
  });

  it("rejects unsupported children and full Columns or Rows slots", () => {
    const form = createComponent("form", "Form");
    const columns = {
      ...createComponent("columns", "Columns"),
      properties: { columnCount: 1 },
      children: ["used-slot"],
    };

    expect(appendProjectComponentToContainer([form], "form", "Button")).toBeNull();
    expect(
      appendProjectComponentToContainer([columns], "columns", "TextInput"),
    ).toBeNull();
  });

  it("assigns new children to the selected default Tabs pane", () => {
    const tabs = {
      ...createComponent("tabs", "Tabs"),
      properties: { tabs: ["First", "Second"], defaultTabIndex: 1 },
    };

    const updated = appendProjectComponentToContainer([tabs], "tabs", "Label");

    expect(updated?.[1]?.layout).toMatchObject({ tabIndex: 1, y: 0 });
  });
});

function createComponent(key: string, type: string): IProjectComponent {
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
    layout: null,
  };
}
