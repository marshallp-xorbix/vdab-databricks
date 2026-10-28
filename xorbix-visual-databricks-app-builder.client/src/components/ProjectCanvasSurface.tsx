import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { DndContext } from "@dnd-kit/core";
import { AppComponent } from "./AppBuilderComponents/AppCanvas/AppComponent";
import { ThemeProvider } from "../context/ThemeContext";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import type { IProjectComponent } from "../models/ProjectComponents";
import {
  PROJECT_COMPONENT_ADD_TYPES,
  type ProjectComponentAddType,
} from "../utils/projectComponentFactory";
import { toCanvasComponents } from "../utils/projectCanvasAdapter";
import { appendProjectComponentToContainer } from "../utils/projectCanvasDrop";
import { moveProjectComponentBefore } from "../utils/projectComponentTree";

const PROJECT_COMPONENT_CONTAINER_TYPES = [
  "Columns",
  "Expander",
  "Form",
  "Modal",
  "Rows",
  "Tabs",
];

interface IProjectCanvasSurfaceProps {
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  theme: Record<string, string>;
  selectedKey: string | null;
  disabled: boolean;
  onSelect: (key: string) => void;
  onAddComponent: (type: ProjectComponentAddType) => void;
  onComponentsChange: (components: IProjectComponent[]) => void;
}

/** Shows a selectable, reorderable canvas backed by the saved component tree. */
function ProjectCanvasSurface({
  components,
  definitions,
  theme,
  selectedKey,
  disabled,
  onSelect,
  onAddComponent,
  onComponentsChange,
}: Readonly<IProjectCanvasSurfaceProps>) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const canvasComponents = useMemo(
    () => toCanvasComponents(components, definitions),
    [components, definitions],
  );
  const canvasComponentsById = useMemo(
    () =>
      new Map(canvasComponents.map((component) => [component.id, component])),
    [canvasComponents],
  );
  const childKeys = useMemo(
    () => new Set(components.flatMap((component) => component.children)),
    [components],
  );
  const rootComponents = components.filter(
    (component) => !childKeys.has(component.key),
  );

  function handleDrop(targetKey: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const sourceKey = event.dataTransfer.getData("text/vdab-component-key");
    const newComponentType = event.dataTransfer.getData(
      "text/vdab-component-type",
    );
    setDraggedKey(null);
    if (isProjectComponentAddType(newComponentType) && !disabled) {
      const targetComponent = components.find(
        (component) => component.key === targetKey,
      );
      const updatedComponents = appendProjectComponentToContainer(
        components,
        targetKey,
        newComponentType,
      );
      if (targetComponent && isProjectComponentContainer(targetComponent.type)) {
        if (updatedComponents) {
          onComponentsChange(updatedComponents);
          const selectedComponent = updatedComponents.at(-1);
          if (selectedComponent) onSelect(selectedComponent.key);
        }
        return;
      }
      if (updatedComponents) {
        onComponentsChange(updatedComponents);
        const selectedComponent = updatedComponents.at(-1);
        if (selectedComponent) onSelect(selectedComponent.key);
      } else {
        onAddComponent(newComponentType);
      }
      return;
    }
    if (!sourceKey || sourceKey === targetKey || disabled) return;
    onComponentsChange(
      moveProjectComponentBefore(components, sourceKey, targetKey),
    );
  }

  function handleCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const newComponentType = event.dataTransfer.getData(
      "text/vdab-component-type",
    );
    setDraggedKey(null);
    if (isProjectComponentAddType(newComponentType) && !disabled) {
      onAddComponent(newComponentType);
    }
  }

  return (
    <section
      aria-labelledby="project-canvas-heading"
      className="min-h-[34rem] overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 id="project-canvas-heading" className="font-semibold">
            Canvas
          </h2>
          <p className="text-xs text-muted-foreground">
            Select an element to edit it. Drag elements to reorder within the
            same container.
          </p>
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {components.length} {components.length === 1 ? "element" : "elements"}
        </span>
      </header>
      <div
        className="min-h-[30rem] bg-[radial-gradient(var(--border)_0.7px,transparent_0.7px)] [background-size:16px_16px] p-5 sm:p-8"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleCanvasDrop}
      >
        <div className="mx-auto min-h-[25rem] max-w-3xl rounded-lg border border-border bg-background p-5 shadow-sm sm:p-8">
          {rootComponents.length === 0 ? (
            <div className="grid min-h-80 place-items-center rounded-md border-2 border-dashed border-border px-6 text-center">
              <div>
                <p className="font-medium">Your app canvas is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a component from the palette to start building.
                </p>
              </div>
            </div>
          ) : (
            <DndContext>
              <ol className="grid gap-3" aria-label="App canvas components">
                {rootComponents.map((component) => (
                  <CanvasNode
                    key={component.key}
                    component={component}
                    canvasComponentsById={canvasComponentsById}
                  theme={theme}
                    selectedKey={selectedKey}
                    disabled={disabled}
                    draggedKey={draggedKey}
                    onDragStart={(key, event) => {
                      setDraggedKey(key);
                      event.stopPropagation();
                      event.dataTransfer.setData(
                        "text/vdab-component-key",
                        key,
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggedKey(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    onSelect={onSelect}
                  />
                ))}
              </ol>
            </DndContext>
          )}
        </div>
      </div>
    </section>
  );
}

interface ICanvasNodeProps {
  component: IProjectComponent;
  theme: Record<string, string>;
  canvasComponentsById: ReadonlyMap<
    string,
    ReturnType<typeof toCanvasComponents>[number]
  >;
  selectedKey: string | null;
  disabled: boolean;
  draggedKey: string | null;
  onDragStart: (key: string, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (key: string, event: DragEvent<HTMLElement>) => void;
  onSelect: (key: string) => void;
}

function CanvasNode({
  component,
  theme,
  canvasComponentsById,
  selectedKey,
  disabled,
  draggedKey,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSelect,
}: Readonly<ICanvasNodeProps>) {
  const isSelected = selectedKey === component.key;
  const label = readCanvasLabel(component);
  const canvasComponent = canvasComponentsById.get(component.key);

  return (
    <li
      className={`min-w-0 rounded-md border bg-background transition-colors ${
        isSelected ? "border-primary ring-2 ring-primary/25" : "border-border"
      } ${draggedKey === component.key ? "opacity-45" : ""}`}
      draggable={!disabled}
      onDragStart={(event) => onDragStart(component.key, event)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(component.key, event)}
    >
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-pressed={isSelected}
        aria-label={`Select ${component.type}: ${label}`}
        disabled={disabled}
        onClick={() => onSelect(component.key)}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {component.type}
          </span>
          <span className="block truncate text-sm font-medium">{label}</span>
        </span>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          Drag to move
        </span>
      </button>
      {canvasComponent && (
        <div
          className="px-3 pb-3 [&_.appcomponent-controls]:hidden"
          onClick={() => onSelect(component.key)}
        >
          <ThemeProvider>
            <AppComponent
              component={canvasComponent}
              theme={theme}
              onRemove={() => undefined}
              onSelect={onSelect}
              isSelected={isSelected}
              selectedComponentId={selectedKey ?? undefined}
              allComponents={[...canvasComponentsById.values()]}
              disableInternalDrag
              onCanvasDragStart={(key, event) => {
                setDraggedKey(key);
                event.stopPropagation();
                event.dataTransfer.setData("text/vdab-component-key", key);
                event.dataTransfer.effectAllowed = "move";
              }}
              onCanvasDragEnd={() => setDraggedKey(null)}
              onCanvasDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onCanvasDrop={(key, event) => handleDrop(key, event)}
            />
          </ThemeProvider>
        </div>
      )}
    </li>
  );
}

function readCanvasLabel(component: IProjectComponent): string {
  const properties = component.properties;
  for (const key of ["label", "text", "title", "placeholder", "buttonLabel"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return component.codeName || component.type;
}

function isProjectComponentAddType(
  value: string,
): value is ProjectComponentAddType {
  return PROJECT_COMPONENT_ADD_TYPES.some((type) => type === value);
}

function isProjectComponentContainer(type: string): boolean {
  return PROJECT_COMPONENT_CONTAINER_TYPES.some(
    (containerType) => containerType === type,
  );
}

export default ProjectCanvasSurface;
