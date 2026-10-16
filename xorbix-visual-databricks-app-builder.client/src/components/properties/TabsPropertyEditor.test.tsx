import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TabsPropertyEditor } from "./TabsPropertyEditor";
import { createComponent } from "../../utils/__tests__/testingUtils";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";
import { createTabChildLayout } from "../../utils/layoutUtils";

describe("TabsPropertyEditor", () => {
  it("deletes an empty tab immediately when no delete callback is provided", () => {
    const onPropertyChange = vi.fn();
    const tabsComponent = createComponent({
      id: "tabs-1",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      props: { tabs: ["Tab 1", "Tab 2"] },
      children: [],
    });

    render(
      <TabsPropertyEditor
        component={tabsComponent}
        allComponents={[]}
        onPropertyChange={onPropertyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Tabs 2" }));

    expect(onPropertyChange).toHaveBeenCalledWith("tabs", ["Tab 1"]);
  });

  it("does not delete a tab with children when delete callback is missing", () => {
    const onPropertyChange = vi.fn();
    const child = createComponent({
      id: "child-1",
      type: ComponentType.TextInput,
      layout: createTabChildLayout(1, 0),
    });
    const tabsComponent = createComponent({
      id: "tabs-1",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      props: { tabs: ["Tab 1", "Tab 2"] },
      children: ["child-1"],
    });

    render(
      <TabsPropertyEditor
        component={tabsComponent}
        allComponents={[tabsComponent, child]}
        onPropertyChange={onPropertyChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Tabs 2" }));

    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete Tab")).not.toBeInTheDocument();
  });

  it("uses onDeleteTab for tabs with children after confirmation", () => {
    const onPropertyChange = vi.fn();
    const onDeleteTab = vi.fn();
    const child = createComponent({
      id: "child-1",
      type: ComponentType.TextInput,
      layout: createTabChildLayout(1, 0),
    });
    const tabsComponent = createComponent({
      id: "tabs-1",
      type: ComponentType.Tabs,
      category: ComponentCategory.Layout,
      props: { tabs: ["Tab 1", "Tab 2"] },
      children: ["child-1"],
    });

    render(
      <TabsPropertyEditor
        component={tabsComponent}
        allComponents={[tabsComponent, child]}
        onPropertyChange={onPropertyChange}
        onDeleteTab={onDeleteTab}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Tabs 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Tab and Children" }),
    );

    expect(onDeleteTab).toHaveBeenCalledWith("tabs-1", 1);
    expect(onPropertyChange).not.toHaveBeenCalled();
  });
});
