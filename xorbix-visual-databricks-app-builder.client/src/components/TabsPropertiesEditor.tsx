import { useEffect, useState } from "react";
import { ConfirmActionDialog } from "./account/ConfirmActionDialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { IProjectComponent, ProjectJsonObject } from "../models/ProjectComponents";
import {
  LAYOUT_CHILD_TYPES,
  type LayoutChildComponentType,
} from "../utils/projectComponentFactory";

const MAX_TAB_NAME_LENGTH = 100;

interface ITabsPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  childComponents: IProjectComponent[];
  activeTabIndex: number;
  disabled: boolean;
  onChange: (properties: ProjectJsonObject) => void;
  onActiveTabChange: (tabIndex: number) => void;
  onAddChild: (type: LayoutChildComponentType, tabIndex: number) => void;
  onRemoveTab: (tabIndex: number) => void;
}

function TabsPropertiesEditor({
  componentKey,
  properties,
  childComponents,
  activeTabIndex,
  disabled,
  onChange,
  onActiveTabChange,
  onAddChild,
  onRemoveTab,
}: Readonly<ITabsPropertiesEditorProps>) {
  const [childType, setChildType] = useState<LayoutChildComponentType>("TextInput");
  const [pendingDeleteTabIndex, setPendingDeleteTabIndex] = useState<number | null>(null);
  const tabs = readTabNames(properties.tabs);
  const defaultTabIndex = readDefaultTabIndex(properties.defaultTabIndex, tabs.length);
  const activeChildCount = countTabChildren(childComponents, activeTabIndex);
  const pendingChildCount = pendingDeleteTabIndex === null
    ? 0
    : countTabChildren(childComponents, pendingDeleteTabIndex);
  const activeTabId = `tabs-active-${componentKey}`;
  const defaultTabId = `tabs-default-${componentKey}`;
  const childTypeId = `tabs-child-type-${componentKey}`;
  const ambiguousDefault = tabs.indexOf(tabs[defaultTabIndex] ?? "") !== defaultTabIndex;

  useEffect(() => {
    if (activeTabIndex >= tabs.length) {
      onActiveTabChange(Math.max(tabs.length - 1, 0));
    }
  }, [activeTabIndex, onActiveTabChange, tabs.length]);

  function renameTab(tabIndex: number, value: string) {
    onChange({
      ...properties,
      tabs: tabs.map((tabName, index) => index === tabIndex ? value : tabName),
    });
  }

  function addTab() {
    onChange({ ...properties, tabs: [...tabs, `Tab ${tabs.length + 1}`] });
    onActiveTabChange(tabs.length);
  }

  function requestRemoveTab(tabIndex: number) {
    if (countTabChildren(childComponents, tabIndex) > 0) {
      setPendingDeleteTabIndex(tabIndex);
      return;
    }
    onRemoveTab(tabIndex);
  }

  function confirmRemoveTab() {
    if (pendingDeleteTabIndex !== null) {
      onRemoveTab(pendingDeleteTabIndex);
      setPendingDeleteTabIndex(null);
    }
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Tabs properties</legend>
      <div className="grid gap-3">
        {tabs.map((tabName, tabIndex) => (
          <div key={`${componentKey}-tab-${tabIndex}`} className="grid gap-2">
            <Label htmlFor={`tabs-name-${componentKey}-${tabIndex}`}>Tab {tabIndex + 1} name</Label>
            <input
              id={`tabs-name-${componentKey}-${tabIndex}`}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={tabName}
              maxLength={MAX_TAB_NAME_LENGTH}
              onChange={(event) => renameTab(tabIndex, event.target.value)}
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addTab}>Add tab</Button>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={defaultTabId}>Default tab</Label>
        <select
          id={defaultTabId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={defaultTabIndex}
          onChange={(event) => onChange({ ...properties, defaultTabIndex: Number(event.target.value) })}
        >
          {tabs.map((tabName, tabIndex) => (
            <option key={`${componentKey}-default-${tabIndex}`} value={tabIndex}>
              {tabIndex + 1}. {tabName}
            </option>
          ))}
        </select>
      </div>
      {ambiguousDefault && (
        <p role="alert" className="text-sm text-destructive">
          The default tab name must be different from earlier tab names.
        </p>
      )}

      <div className="grid gap-3 rounded-md border border-border p-3">
        <div className="grid gap-2">
          <Label htmlFor={activeTabId}>Edit tab contents</Label>
          <select
            id={activeTabId}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={Math.min(activeTabIndex, Math.max(tabs.length - 1, 0))}
            onChange={(event) => onActiveTabChange(Number(event.target.value))}
          >
            {tabs.map((tabName, tabIndex) => (
              <option key={`${componentKey}-active-${tabIndex}`} value={tabIndex}>
                {tabIndex + 1}. {tabName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={childTypeId}>Child component type</Label>
          <select
            id={childTypeId}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={childType}
            onChange={(event) => setChildType(event.target.value as LayoutChildComponentType)}
          >
            {LAYOUT_CHILD_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAddChild(childType, activeTabIndex)}
          >
            Add child component
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {activeChildCount} {activeChildCount === 1 ? "component" : "components"} in this tab
          </p>
          {tabs.length > 1 && (
            <Button type="button" variant="destructive" onClick={() => requestRemoveTab(activeTabIndex)}>
              Remove active tab
            </Button>
          )}
        </div>
      </div>

      <ConfirmActionDialog
        open={pendingDeleteTabIndex !== null}
        onOpenChange={(open) => !open && setPendingDeleteTabIndex(null)}
        title="Delete tab and its components?"
        description={`Deleting this tab will also remove ${pendingChildCount} component${pendingChildCount === 1 ? "" : "s"} from the project.`}
        confirmLabel="Delete tab and components"
        onConfirm={confirmRemoveTab}
      />
    </fieldset>
  );
}

function readTabNames(value: unknown): string[] {
  return Array.isArray(value) && value.every((tabName) => typeof tabName === "string")
    ? value
    : ["Tab 1", "Tab 2"];
}

function readDefaultTabIndex(value: unknown, tabCount: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < tabCount
    ? value
    : 0;
}

function countTabChildren(children: IProjectComponent[], tabIndex: number): number {
  return children.filter((child) => child.layout?.tabIndex === tabIndex).length;
}

export default TabsPropertiesEditor;
