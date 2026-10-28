import { useMemo } from "react";
import { MouseSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { IComponentDefinition } from "../models/ComponentRegistry";
import type {
  IProjectComponent,
  ProjectJsonObject,
} from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { WorkflowDefinition } from "../types/workflow";
import type { VdabComponent } from "../types/components/vdabComponent";
import { useComponentRegistry } from "../context/ComponentRegistryContext";
import { useComponentDragDrop } from "./useComponentDragDrop";
import { CanvasContextType } from "../types/editor";
import { toCanvasComponents } from "../utils/projectCanvasAdapter";
import {
  addProjectComponentFromLegacyCanvas,
  moveProjectComponentInLegacyCanvas,
} from "../utils/projectCanvasAdapter";
import { removeProjectComponentSubtree } from "../utils/projectComponentTree";
import { removeWorkflowsForProjectComponents } from "../utils/projectWorkflowComponentReferences";
import { toPortableWorkflowDefinition } from "../utils/projectWorkflowContractAdapter";
import type { AddComponentOptions } from "../types/components/componentOperations";
import { buildVdabComponentFromRegistryEntry } from "../utils/dndComponentFactory";
import {
  toCanonicalComponentCategory,
  toCanonicalComponentType,
} from "../utils/componentEnumGuards";
import { getRegistryDefinitionType } from "../utils/registryComponentUtils";

interface IUseProjectLegacyCanvasOptions {
  components: IProjectComponent[];
  definitions: IComponentDefinition[];
  workflow: IProjectWorkflowDefinition;
  isDisabled: boolean;
  contextType: CanvasContextType;
  modalId?: string;
  onComponentsChange: (components: IProjectComponent[]) => void;
  onWorkflowChange: (workflow: IProjectWorkflowDefinition) => void;
  onSelectComponent: (componentKey: string) => void;
}

/** Connects retained SaaS canvas components to the standalone project model. */
export function useProjectLegacyCanvas({
  components,
  definitions,
  workflow,
  isDisabled,
  contextType,
  modalId,
  onComponentsChange,
  onWorkflowChange,
  onSelectComponent,
}: Readonly<IUseProjectLegacyCanvasOptions>) {
  const { registry } = useComponentRegistry();
  const canvasComponents = useMemo(
    () => toCanvasComponents(components, definitions),
    [components, definitions],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );
  const dragDrop = useComponentDragDrop({
    registry,
    formComponents: canvasComponents,
    contextType,
    modalId,
    isEnabled: !isDisabled,
    onMoveComponent: (componentKey, target) => {
      onComponentsChange(
        moveProjectComponentInLegacyCanvas(
          components,
          canvasComponents,
          componentKey,
          target,
          contextType,
          modalId,
        ),
      );
    },
    onAddComponent: (component, _contextType, _modalId, options) => {
      addCanvasComponent(component, options, _contextType, _modalId);
    },
  });

  function addCanvasComponent(
    component: VdabComponent,
    options?: AddComponentOptions,
    targetContextType: CanvasContextType = contextType,
    targetModalId?: string,
  ) {
    const result = addProjectComponentFromLegacyCanvas(
      components,
      component,
      options,
      targetContextType,
      targetModalId,
    );
    if (!result) return;
    onComponentsChange(result.components);
    onSelectComponent(result.component.key);
  }

  function addCanvasComponentFromPalette(
    componentType: string,
    category: string,
  ) {
    const type = toCanonicalComponentType(componentType);
    const componentCategory = toCanonicalComponentCategory(category);
    if (!type || !componentCategory) return;

    const registryEntry = registry?.components.find(
      (entry) =>
        toCanonicalComponentType(getRegistryDefinitionType(entry)) === type,
    );
    const component = buildVdabComponentFromRegistryEntry({
      type,
      category: componentCategory,
      registryEntry,
    });
    addCanvasComponent(component);
  }

  function removeCanvasComponent(
    componentKey: string,
  ) {
    const removal = removeProjectComponentSubtree(components, componentKey);
    if (removal.removedComponents.length === 0) return;
    onComponentsChange(removal.components);
    onWorkflowChange(
      removeWorkflowsForProjectComponents(workflow, removal.removedComponents),
    );
  }

  function updateCanvasComponent(
    componentKey: string,
    updates: Record<string, unknown>,
  ) {
    onComponentsChange(
      components.map((component) => {
        if (component.key !== componentKey) return component;
        const nextProperties = updates.props;
        return {
          ...component,
          ...(typeof updates.codeName === "string"
            ? { codeName: updates.codeName }
            : {}),
          ...(isJsonObject(nextProperties)
            ? { properties: nextProperties }
            : {}),
        };
      }),
    );
  }

  function updateCanvasBindings(
    componentKey: string,
    bindings: Record<string, unknown> | null,
  ) {
    onComponentsChange(
      components.map((component) =>
        component.key === componentKey ? { ...component, bindings } : component,
      ),
    );
  }

  function updateCanvasWorkflow(nextWorkflow: WorkflowDefinition) {
    onWorkflowChange(toPortableWorkflowDefinition(nextWorkflow, components));
  }

  return {
    canvasComponents,
    sensors,
    dragDrop,
    addCanvasComponent,
    addCanvasComponentFromPalette,
    removeCanvasComponent,
    updateCanvasComponent,
    updateCanvasBindings,
    updateCanvasWorkflow,
  };
}

function isJsonObject(value: unknown): value is ProjectJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
