import { useEffect, useState } from "react";
import type {
  IProjectComponent,
  ProjectJsonObject,
} from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import {
  readDefaultTabIndex,
  readLayoutSlotCount,
  readNextTabChildY,
  readTabIndex,
  readTabNames,
} from "../utils/projectComponentLayout";
import {
  createProjectComponent,
  LAYOUT_CHILD_TYPES,
  type FormChildComponentType,
  type LayoutChildComponentType,
  type ModalChildComponentType,
  type ProjectComponentAddType,
} from "../utils/projectComponentFactory";
import {
  getProjectComponentMoveAvailability,
  moveProjectComponent,
  removeProjectComponentSubtree,
  type ProjectComponentMoveDirection,
} from "../utils/projectComponentTree";
import { removeWorkflowsForProjectComponents } from "../utils/projectWorkflowComponentReferences";

interface IUseProjectComponentEditorOptions {
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  onComponentsChange: (components: IProjectComponent[]) => void;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
}

/** Owns selection and component editing actions for the project component editor. */
export function useProjectComponentEditor({
  components,
  workflow,
  onComponentsChange,
  onWorkflowChange,
}: Readonly<IUseProjectComponentEditorOptions>) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeTabByKey, setActiveTabByKey] = useState<Record<string, number>>(
    {},
  );
  const selectedComponent = components.find(
    (component) => component.key === selectedKey,
  );
  const moveAvailability = getProjectComponentMoveAvailability(
    components,
    selectedKey,
  );

  useEffect(() => {
    if (
      selectedKey &&
      !components.some((component) => component.key === selectedKey)
    ) {
      setSelectedKey(null);
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
      (selectedComponent.type === "Columns" ||
        selectedComponent.type === "Rows") &&
      selectedComponent.children.length >=
        readLayoutSlotCount(
          selectedComponent.type,
          selectedComponent.properties,
        )
    ) {
      return;
    }

    const createdChild = createProjectComponent(type, components);
    const child =
      selectedComponent.type === "Tabs"
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
    const isControl = LAYOUT_CHILD_TYPES.some(
      (controlType) => controlType === type,
    );
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
    const nextDefaultTabIndex =
      defaultTabIndex === tabIndex
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
            children: component.children.filter(
              (key) => !removedChildKeys.has(key),
            ),
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

  function moveSelectedComponent(direction: ProjectComponentMoveDirection) {
    if (!selectedComponent) {
      return;
    }

    onComponentsChange(
      moveProjectComponent(components, selectedComponent.key, direction),
    );
  }

  function removeSelectedComponent() {
    if (!selectedComponent) {
      return;
    }

    const parent = components.find((component) =>
      component.children.includes(selectedComponent.key),
    );
    const removal = removeProjectComponentSubtree(
      components,
      selectedComponent.key,
    );
    if (removal.removedComponents.length === 0) {
      return;
    }

    onComponentsChange(removal.components);
    onWorkflowChange(
      removeWorkflowsForProjectComponents(workflow, removal.removedComponents),
    );
    setSelectedKey(parent?.key ?? readFirstRootKey(removal.components));
  }

  return {
    selectedKey,
    selectedComponent,
    activeTabIndex: selectedComponent
      ? (activeTabByKey[selectedComponent.key] ?? 0)
      : 0,
    ...moveAvailability,
    selectComponent: setSelectedKey,
    addComponent,
    addLayoutChild,
    addFormChild,
    addModalChild,
    removeSelectedTab,
    changeSelectedProperties,
    changeSelectedBindings,
    moveSelectedComponent,
    removeSelectedComponent,
    setActiveTabIndex(tabIndex: number) {
      if (!selectedComponent) {
        return;
      }

      setActiveTabByKey((current) => ({
        ...current,
        [selectedComponent.key]: tabIndex,
      }));
    },
  };
}

function readFirstRootKey(components: IProjectComponent[]): string | null {
  const childKeys = new Set(
    components.flatMap((component) => component.children),
  );
  return (
    components.find((component) => !childKeys.has(component.key))?.key ?? null
  );
}
