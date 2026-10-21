import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import TextInputPropertiesEditor from "./TextInputPropertiesEditor";
import ButtonPropertiesEditor from "./ButtonPropertiesEditor";
import BooleanControlPropertiesEditor from "./BooleanControlPropertiesEditor";
import DropdownPropertiesEditor from "./DropdownPropertiesEditor";
import DateTimeControlPropertiesEditor from "./DateTimeControlPropertiesEditor";
import SliderPropertiesEditor from "./SliderPropertiesEditor";
import LabelPropertiesEditor from "./LabelPropertiesEditor";
import ExpanderPropertiesEditor from "./ExpanderPropertiesEditor";
import ColumnsPropertiesEditor from "./ColumnsPropertiesEditor";
import RowsPropertiesEditor from "./RowsPropertiesEditor";
import TabsPropertiesEditor from "./TabsPropertiesEditor";
import FormPropertiesEditor from "./FormPropertiesEditor";
import ModalPropertiesEditor from "./ModalPropertiesEditor";
import FileUploadPropertiesEditor from "./FileUploadPropertiesEditor";
import DataWindowPropertiesEditor from "./DataWindowPropertiesEditor";
import EditableDataWindowPropertiesEditor from "./EditableDataWindowPropertiesEditor";
import CartesianChartPropertiesEditor from "./CartesianChartPropertiesEditor";
import AmoebaStoryPropertiesEditor from "./AmoebaStoryPropertiesEditor";
import FlowFieldStoryPropertiesEditor from "./FlowFieldStoryPropertiesEditor";
import HeatMapStoryPropertiesEditor from "./HeatMapStoryPropertiesEditor";
import HoneycombStoryPropertiesEditor from "./HoneycombStoryPropertiesEditor";
import NetworkWebStoryPropertiesEditor from "./NetworkWebStoryPropertiesEditor";
import PulseWaveStoryPropertiesEditor from "./PulseWaveStoryPropertiesEditor";
import SpiralStoryPropertiesEditor from "./SpiralStoryPropertiesEditor";
import TerrainStoryPropertiesEditor from "./TerrainStoryPropertiesEditor";
import DashboardEmbedPropertiesEditor from "./DashboardEmbedPropertiesEditor";
import GenieChatPropertiesEditor from "./GenieChatPropertiesEditor";
import ModelChatPropertiesEditor from "./ModelChatPropertiesEditor";
import ProjectComponentList from "./ProjectComponentList";
import ProjectPreviewPanel from "./ProjectPreviewPanel";
import type {
  IProjectComponent,
  IProjectPreview,
  ProjectJsonObject,
} from "../models/ProjectComponents";
import {
  createProjectComponent,
  LAYOUT_CHILD_TYPES,
  PROJECT_COMPONENT_ADD_TYPES,
  type LayoutChildComponentType,
  type FormChildComponentType,
  type ModalChildComponentType,
  type ProjectComponentAddType,
} from "../utils/projectComponentFactory";

interface IProjectComponentsEditorProps {
  components: IProjectComponent[];
  isDirty: boolean;
  isSaving: boolean;
  isDisabled: boolean;
  saveError: string | null;
  preview: IProjectPreview | null;
  isPreviewing: boolean;
  previewError: string | null;
  onComponentsChange: (components: IProjectComponent[]) => void;
  onSave: () => void;
  onReload: () => void;
  onPreview: () => void;
}

const ADD_COMPONENT_LABELS: Record<ProjectComponentAddType, string> = {
  DashboardEmbed: "Add dashboard embed",
  GenieChat: "Add Genie chat",
  ModelChat: "Add Model chat",
  TextInput: "Add Text input",
  Button: "Add button",
  Checkbox: "Add checkbox",
  Toggle: "Add toggle",
  Dropdown: "Add dropdown",
  DatePicker: "Add date picker",
  TimePicker: "Add time picker",
  FileUpload: "Add file upload",
  DataWindow: "Add data window",
  EditableDataWindow: "Add editable data window",
  Slider: "Add slider",
  Label: "Add label",
  Expander: "Add expander",
  Columns: "Add columns",
  Rows: "Add rows",
  Tabs: "Add tabs",
  Form: "Add form",
  Modal: "Add modal",
  BarChart: "Add bar chart",
  LineChart: "Add line chart",
  PieChart: "Add pie chart",
  DonutChart: "Add donut chart",
  AmoebaStory: "Add Amoeba story",
  FlowFieldStory: "Add Flow Field story",
  HeatMapStory: "Add heat map story",
  HoneycombStory: "Add honeycomb story",
  NetworkWebStory: "Add network web story",
  PulseWaveStory: "Add pulse wave story",
  SpiralStory: "Add spiral story",
  TerrainStory: "Add terrain story",
};

function ProjectComponentsEditor({
  components,
  isDirty,
  isSaving,
  isDisabled,
  saveError,
  preview,
  isPreviewing,
  previewError,
  onComponentsChange,
  onSave,
  onReload,
  onPreview,
}: Readonly<IProjectComponentsEditorProps>) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    components[0]?.key ?? null,
  );
  const [activeTabByKey, setActiveTabByKey] = useState<Record<string, number>>({});
  const selectedComponent = components.find(
    (component) => component.key === selectedKey,
  );

  useEffect(() => {
    if (!selectedKey || !components.some((component) => component.key === selectedKey)) {
      setSelectedKey(components[0]?.key ?? null);
    }
  }, [components, selectedKey]);

  function addComponent(type: ProjectComponentAddType) {
    const component = createProjectComponent(type, components);
    onComponentsChange([...components, component]);
    setSelectedKey(component.key);
  }

  function addLayoutChild(type: LayoutChildComponentType, tabIndex?: number) {
    if (
      (selectedComponent?.type !== "Expander" &&
        selectedComponent?.type !== "Columns" &&
        selectedComponent?.type !== "Rows" &&
        selectedComponent?.type !== "Tabs") ||
      !LAYOUT_CHILD_TYPES.includes(type)
    ) {
      return;
    }

    if (selectedComponent.type === "Tabs" && tabIndex === undefined) {
      return;
    }

    if (
      (selectedComponent.type === "Columns" || selectedComponent.type === "Rows") &&
      selectedComponent.children.length >=
        readLayoutSlotCount(selectedComponent.type, selectedComponent.properties)
    ) {
      return;
    }

    const createdChild = createProjectComponent(type, components);
    const child = selectedComponent.type === "Tabs"
      ? {
          ...createdChild,
          layout: {
            tabIndex,
            y: readNextTabChildY(selectedComponent, components, tabIndex),
          },
        }
      : createdChild;
    const updatedComponents = components.map((component) =>
      component.key === selectedComponent.key
        ? { ...component, children: [...component.children, child.key] }
        : component,
    );
    onComponentsChange([...updatedComponents, child]);
    setSelectedKey(child.key);
  }

  function addFormChild(type: FormChildComponentType) {
    if (selectedComponent?.type !== "Form") {
      return;
    }

    const createdChild = createProjectComponent(type, components);
    const updatedComponents = components.map((component) =>
      component.key === selectedComponent.key
        ? { ...component, children: [...component.children, createdChild.key] }
        : component,
    );
    onComponentsChange([...updatedComponents, createdChild]);
    setSelectedKey(createdChild.key);
  }

  function addModalChild(type: ModalChildComponentType) {
    if (selectedComponent?.type !== "Modal") {
      return;
    }

    const createdChild = createProjectComponent(type, components);
    const isControl = LAYOUT_CHILD_TYPES.some((controlType) => controlType === type);
    const child = isControl
      ? { ...createdChild, layout: { y: selectedComponent.children.length } }
      : createdChild;
    const updatedComponents = components.map((component) =>
      component.key === selectedComponent.key
        ? { ...component, children: [...component.children, child.key] }
        : component,
    );
    onComponentsChange([...updatedComponents, child]);
    setSelectedKey(child.key);
  }

  function removeSelectedTab(tabIndex: number) {
    if (selectedComponent?.type !== "Tabs") {
      return;
    }

    const tabs = readTabNames(selectedComponent.properties.tabs);
    if (tabs.length <= 1 || tabIndex < 0 || tabIndex >= tabs.length) {
      return;
    }

    const removedChildKeys = new Set(
      selectedComponent.children.filter((key) => {
        const child = components.find((candidate) => candidate.key === key);
        return readTabIndex(child?.layout ?? null) === tabIndex;
      }),
    );
    const nextTabs = tabs.filter((_, index) => index !== tabIndex);
    const defaultTabIndex = readDefaultTabIndex(
      selectedComponent.properties.defaultTabIndex,
      tabs.length,
    );
    const nextDefaultTabIndex = defaultTabIndex === tabIndex
      ? Math.min(tabIndex, nextTabs.length - 1)
      : defaultTabIndex > tabIndex
      ? defaultTabIndex - 1
      : defaultTabIndex;
    const nextComponents = components
      .filter((component) => !removedChildKeys.has(component.key))
      .map((component) => {
        if (component.key === selectedComponent.key) {
          return {
            ...component,
            properties: {
              ...component.properties,
              tabs: nextTabs,
              defaultTabIndex: nextDefaultTabIndex,
            },
            children: component.children.filter((key) => !removedChildKeys.has(key)),
          };
        }

        const childTabIndex = readTabIndex(component.layout);
        if (childTabIndex !== null && childTabIndex > tabIndex) {
          return {
            ...component,
            layout: { ...component.layout, tabIndex: childTabIndex - 1 },
          };
        }

        return component;
      });

    onComponentsChange(nextComponents);
    setActiveTabByKey((current) => ({
      ...current,
      [selectedComponent.key]: Math.min(tabIndex, nextTabs.length - 1),
    }));
  }

  function changeSelectedProperties(properties: ProjectJsonObject) {
    if (!selectedComponent) {
      return;
    }

    onComponentsChange(
      components.map((component) =>
        component.key === selectedComponent.key
          ? { ...component, properties }
          : component,
      ),
    );
  }

  function changeSelectedBindings(bindings: ProjectJsonObject | null) {
    if (!selectedComponent) {
      return;
    }

    onComponentsChange(
      components.map((component) =>
        component.key === selectedComponent.key
          ? { ...component, bindings }
          : component,
      ),
    );
  }

  return (
    <section aria-labelledby="project-components-heading" className="grid gap-5 rounded-xl border border-border bg-card p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="project-components-heading" className="text-xl font-semibold">
            App components
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add controls and layout containers. Children inside an expander, column, row, tab, or form follow the order shown in the component list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COMPONENT_ADD_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              disabled={isDisabled}
              onClick={() => addComponent(type)}
            >
              {ADD_COMPONENT_LABELS[type]}
            </Button>
          ))}
        </div>
      </header>

      {components.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No components yet. Add a control to start the app canvas.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
          <ProjectComponentList
            components={components}
            selectedKey={selectedKey}
            disabled={isDisabled}
            onSelect={setSelectedKey}
          />

          {selectedComponent?.type === "TextInput" ? (
            <TextInputPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "DashboardEmbed" ? (
            <DashboardEmbedPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "GenieChat" ? (
            <GenieChatPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "ModelChat" ? (
            <ModelChatPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Button" ? (
            <ButtonPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Checkbox" || selectedComponent?.type === "Toggle" ? (
            <BooleanControlPropertiesEditor
              componentKey={selectedComponent.key}
              componentType={selectedComponent.type}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Dropdown" ? (
            <DropdownPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "DatePicker" || selectedComponent?.type === "TimePicker" ? (
            <DateTimeControlPropertiesEditor
              componentKey={selectedComponent.key}
              componentType={selectedComponent.type}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Slider" ? (
            <SliderPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Label" ? (
            <LabelPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
            />
          ) : selectedComponent?.type === "Expander" ? (
            <ExpanderPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childCount={selectedComponent.children.length}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onAddChild={addLayoutChild}
            />
          ) : selectedComponent?.type === "Columns" ? (
            <ColumnsPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childCount={selectedComponent.children.length}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onAddChild={addLayoutChild}
            />
          ) : selectedComponent?.type === "Rows" ? (
            <RowsPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childCount={selectedComponent.children.length}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onAddChild={addLayoutChild}
            />
          ) : selectedComponent?.type === "Tabs" ? (
            <TabsPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childComponents={selectedComponent.children.flatMap((key) => {
                const child = components.find((component) => component.key === key);
                return child ? [child] : [];
              })}
              activeTabIndex={activeTabByKey[selectedComponent.key] ?? 0}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onActiveTabChange={(tabIndex) => setActiveTabByKey((current) => ({
                ...current,
                [selectedComponent.key]: tabIndex,
              }))}
              onAddChild={addLayoutChild}
              onRemoveTab={removeSelectedTab}
            />
          ) : selectedComponent?.type === "Form" ? (
            <FormPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childCount={selectedComponent.children.length}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onAddChild={addFormChild}
            />
          ) : selectedComponent?.type === "Modal" ? (
            <ModalPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              childCount={selectedComponent.children.length}
              disabled={isDisabled}
              onChange={changeSelectedProperties}
              onAddChild={addModalChild}
            />
          ) : selectedComponent?.type === "FileUpload" ? (
            <FileUploadPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "DataWindow" ? (
            <DataWindowPropertiesEditor
              componentKey={selectedComponent.key}
              editable={false}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "EditableDataWindow" ? (
            <EditableDataWindowPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "AmoebaStory" ? (
            <AmoebaStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "FlowFieldStory" ? (
            <FlowFieldStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "HeatMapStory" ? (
            <HeatMapStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "HoneycombStory" ? (
            <HoneycombStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "NetworkWebStory" ? (
            <NetworkWebStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "PulseWaveStory" ? (
            <PulseWaveStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "SpiralStory" ? (
            <SpiralStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "TerrainStory" ? (
            <TerrainStoryPropertiesEditor
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : selectedComponent?.type === "BarChart" || selectedComponent?.type === "LineChart" || selectedComponent?.type === "PieChart" || selectedComponent?.type === "DonutChart" ? (
            <CartesianChartPropertiesEditor
              chartType={selectedComponent.type}
              componentKey={selectedComponent.key}
              properties={selectedComponent.properties}
              bindings={selectedComponent.bindings}
              disabled={isDisabled}
              onPropertiesChange={changeSelectedProperties}
              onBindingsChange={changeSelectedBindings}
            />
          ) : (
            <p role="status" className="rounded-md border border-border p-4 text-sm">
              The {selectedComponent?.type ?? "selected"} editor is not available in this slice. Its saved configuration is preserved.
            </p>
          )}
        </div>
      )}

      {saveError && (
        <div role="alert" className="grid gap-2">
          <p>{saveError}</p>
          <div>
            <Button type="button" variant="outline" onClick={onReload}>
              Reload latest components
            </Button>
          </div>
        </div>
      )}
      {isDirty && <p role="status">Component changes are not saved.</p>}
      {!isDirty && isSaving && <p role="status">Saving components…</p>}
      {!isDirty && !isSaving && <p role="status" aria-live="polite">Components saved.</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={isDisabled || !isDirty || isSaving}
          onClick={onSave}
        >
          {isSaving ? "Saving…" : "Save components"}
        </Button>
      </div>
      <ProjectPreviewPanel
        preview={preview}
        isPending={isPreviewing}
        isDisabled={isDisabled || isDirty}
        errorMessage={previewError}
        onPreview={onPreview}
      />
    </section>
  );
}

function readLayoutSlotCount(
  componentType: "Columns" | "Rows",
  properties: ProjectJsonObject,
): number {
  const slotCount = componentType === "Columns"
    ? properties.columnCount
    : properties.rowCount;
  return typeof slotCount === "number" && Number.isSafeInteger(slotCount)
    ? slotCount
    : 2;
}

function readTabNames(value: unknown): string[] {
  return Array.isArray(value) && value.every((tab) => typeof tab === "string")
    ? value
    : ["Tab 1", "Tab 2"];
}

function readDefaultTabIndex(value: unknown, tabCount: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < tabCount
    ? value
    : 0;
}

function readTabIndex(layout: ProjectJsonObject | null): number | null {
  const tabIndex = layout?.tabIndex;
  return typeof tabIndex === "number" && Number.isSafeInteger(tabIndex) && tabIndex >= 0
    ? tabIndex
    : null;
}

function readNextTabChildY(
  tabs: IProjectComponent,
  components: IProjectComponent[],
  tabIndex: number | undefined,
): number {
  if (tabIndex === undefined) {
    return 0;
  }

  const existingPositions = tabs.children.flatMap((key) => {
    const child = components.find((candidate) => candidate.key === key);
    const childTabIndex = readTabIndex(child?.layout ?? null);
    const position = child?.layout?.y;
    return childTabIndex === tabIndex && typeof position === "number" && Number.isFinite(position)
      ? [position]
      : [];
  });
  return existingPositions.length === 0 ? 0 : Math.max(...existingPositions) + 1;
}

export default ProjectComponentsEditor;
