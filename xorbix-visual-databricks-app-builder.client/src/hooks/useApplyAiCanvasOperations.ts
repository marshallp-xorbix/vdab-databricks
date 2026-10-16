import { useCallback } from "react";
import type { CanvasOperation } from "../models/AiBuilderModels";
import type { AppDetails } from "./useAppPersistence";
import type { VdabComponent } from "../types/components/vdabComponent";
import { ComponentType } from "../types/components/componentTypes";
import {
  toCanonicalComponentCategory,
  toCanonicalComponentType,
} from "../utils/componentEnumGuards";
import {
  CanvasContextType,
  getCurrentPageContextKey,
  getModalContextKey,
  isModalContextKey,
  getModalIdFromContextKey,
} from "../types/editor";
import type { WorkflowDefinition } from "../types/workflow";
import {
  removeWorkflowsForComponentIds,
  renameWorkflowComponentReferences,
} from "../components/AppBuilderComponents/Workflow/workflowPanelUtils";
import { generateUniqueCodeName, normalizeCodeName } from "../utils/codeNameUtils";

interface IUseApplyAiCanvasOperationsParams {
  allComponents: VdabComponent[];
  modals: VdabComponent[];
  componentOwnershipIndexes: {
    ownerContextByComponentId: Record<string, string>;
  };
  addComponent: ReturnType<typeof import("./useComponentOperations").useComponentOperations>["addComponent"];
  removeComponentWithTab: ReturnType<typeof import("./useComponentOperations").useComponentOperations>["removeComponentWithTab"];
  moveComponent: ReturnType<typeof import("./useComponentOperations").useComponentOperations>["moveComponent"];
  updateComponent: ReturnType<typeof import("./useComponentOperations").useComponentOperations>["updateComponent"];
  handleAddModal: ReturnType<typeof import("./useComponentOperations").useComponentOperations>["handleAddModal"];
  setWorkflowDefinition: React.Dispatch<React.SetStateAction<WorkflowDefinition>>;
  setAppDetails: React.Dispatch<React.SetStateAction<AppDetails>>;
}

const sleepForReact = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const useApplyAiCanvasOperations = ({
  allComponents,
  modals,
  componentOwnershipIndexes,
  addComponent,
  removeComponentWithTab,
  moveComponent,
  updateComponent,
  handleAddModal,
  setWorkflowDefinition,
  setAppDetails,
}: IUseApplyAiCanvasOperationsParams) => {
  const applyAiCanvasOperations = useCallback(
    async (operations: CanvasOperation[]) => {
      const componentById = new Map(
        allComponents.map((component) => [component.id, component]),
      );
      const ownerContextById = new Map(
        Object.entries(componentOwnershipIndexes.ownerContextByComponentId),
      );
      const modalIds = new Set(modals.map((modal) => modal.id));
      const usedCodeNames = new Set(
        allComponents
          .map((component) => normalizeCodeName(component.codeName))
          .filter((codeName): codeName is string => !!codeName),
      );

      const workflowTriggerKey = (workflow: {
        trigger: { componentCodeName: string; eventKey: string };
      }) =>
        `${workflow.trigger.componentCodeName.trim()}::${workflow.trigger.eventKey.trim()}`;

      const addChildToLocalParent = (parentId: string, childId: string) => {
        const parent = componentById.get(parentId);
        if (!parent) return;

        const children = parent.children ?? [];
        if (children.includes(childId)) return;

        componentById.set(parentId, {
          ...parent,
          children: [...children, childId],
        });
      };

      const removeLocalComponents = (idsToDelete: Set<string>) => {
        idsToDelete.forEach((id) => {
          const component = componentById.get(id);
          const codeName = normalizeCodeName(component?.codeName);
          if (codeName) usedCodeNames.delete(codeName);
          componentById.delete(id);
          ownerContextById.delete(id);
          modalIds.delete(id);
        });

        componentById.forEach((component, id) => {
          if (!component.children?.some((childId) => idsToDelete.has(childId)))
            return;

          componentById.set(id, {
            ...component,
            children: component.children.filter((childId) => !idsToDelete.has(childId)),
          });
        });
      };

      const collectLocalSubtreeIds = (componentId: string): Set<string> => {
        const ids = new Set<string>([componentId]);
        const visit = (id: string) => {
          const component = componentById.get(id);
          component?.children?.forEach((childId) => {
            if (ids.has(childId)) return;
            ids.add(childId);
            visit(childId);
          });
        };

        visit(componentId);
        return ids;
      };

      for (const op of operations) {
        if (op.op === "add" && op.component) {
          const normalizedType = toCanonicalComponentType(String(op.component.type));
          const normalizedCategory = toCanonicalComponentCategory(
            String(op.component.category),
          );

          if (!normalizedType || !normalizedCategory) {
            throw new Error(`AI returned an unsupported component type: ${op.component.type}`);
          }

          const requestedCodeName = normalizeCodeName(op.component.codeName);
          const codeName =
            requestedCodeName && !usedCodeNames.has(requestedCodeName)
              ? requestedCodeName
              : generateUniqueCodeName(normalizedType, usedCodeNames);
          usedCodeNames.add(codeName);

          const normalizedComponent = {
            ...op.component,
            codeName,
            type: normalizedType,
            category: normalizedCategory,
          };

          if (normalizedType === ComponentType.Modal) {
            handleAddModal(normalizedComponent);
            modalIds.add(normalizedComponent.id);
            componentById.set(normalizedComponent.id, normalizedComponent);
          } else {
            let contextType = CanvasContextType.Page;
            let resolvedModalId: string | undefined;
            let effectiveParentId: string | undefined = op.parentId;
            let effectiveChildIndex: number | undefined = op.childIndex;
            let ownerContext = getCurrentPageContextKey();

            if (op.parentId) {
              const parentIsModal = modalIds.has(op.parentId);

              if (parentIsModal) {
                contextType = CanvasContextType.Modal;
                resolvedModalId = op.parentId;
                ownerContext = getModalContextKey(op.parentId);
                effectiveParentId = undefined;
                effectiveChildIndex = Number.MAX_SAFE_INTEGER;
                addChildToLocalParent(op.parentId, normalizedComponent.id);
              } else {
                const parentOwnerContext = ownerContextById.get(op.parentId);
                if (parentOwnerContext && isModalContextKey(parentOwnerContext)) {
                  contextType = CanvasContextType.Modal;
                  resolvedModalId = getModalIdFromContextKey(parentOwnerContext);
                  ownerContext = parentOwnerContext;
                }

                addChildToLocalParent(op.parentId, normalizedComponent.id);
              }
            }

            addComponent(normalizedComponent, contextType, resolvedModalId, {
              parentId: effectiveParentId,
              childIndex: effectiveChildIndex,
              tabIndex: op.tabIndex,
            });

            componentById.set(normalizedComponent.id, normalizedComponent);
            ownerContextById.set(normalizedComponent.id, ownerContext);
          }

          await sleepForReact();
        } else if (op.op === "delete" && op.componentId) {
          const idsToDelete = collectLocalSubtreeIds(op.componentId);
          setWorkflowDefinition((current) =>
            removeWorkflowsForComponentIds(
              current,
              Array.from(componentById.values()),
              idsToDelete,
            ),
          );
          removeComponentWithTab(op.componentId, { mode: "deleteSubtree" });
          removeLocalComponents(idsToDelete);
          await sleepForReact();
        } else if (op.op === "modify" && op.component) {
          const existingComponent = componentById.get(op.component.id);
          if (!existingComponent) {
            throw new Error(`AI tried to modify an unknown component: ${op.component.id}`);
          }

          const updates: Record<string, unknown> = {};
          if (op.component.props !== undefined) {
            updates.props = op.component.props;
          }

          const nextCodeName = normalizeCodeName(op.component.codeName);

          if (nextCodeName && nextCodeName !== existingComponent.codeName) {
            const duplicate = Array.from(componentById.values()).find(
              (component) =>
                component.id !== op.component?.id &&
                normalizeCodeName(component.codeName) === nextCodeName,
            );

            if (duplicate) {
              throw new Error(`AI tried to reuse component codeName '${nextCodeName}'.`);
            }

            setWorkflowDefinition((current) =>
              renameWorkflowComponentReferences(
                current,
                existingComponent.codeName ?? "",
                nextCodeName,
                { isModal: existingComponent.type === ComponentType.Modal },
              ),
            );

            usedCodeNames.delete(existingComponent.codeName);
            usedCodeNames.add(nextCodeName);
            updates.codeName = nextCodeName;
          }

          if (Object.keys(updates).length > 0) {
            updateComponent(op.component.id, updates);
          }

          const updatedComponent = {
            ...existingComponent,
            ...updates,
          } as VdabComponent;
          componentById.set(op.component.id, updatedComponent);

          if (
            op.parentId ||
            typeof op.childIndex === "number" ||
            typeof op.tabIndex === "number"
          ) {
            const parentIsModal = !!op.parentId && modalIds.has(op.parentId);
            const targetContextKey = parentIsModal
              ? getModalContextKey(op.parentId!)
              : op.parentId
                ? ownerContextById.get(op.parentId) ?? getCurrentPageContextKey()
                : ownerContextById.get(op.component.id) ?? getCurrentPageContextKey();

            moveComponent(op.component.id, {
              contextKey: targetContextKey,
              parentId: parentIsModal ? undefined : op.parentId,
              childIndex: op.childIndex,
              tabIndex: op.tabIndex,
            });

            ownerContextById.set(op.component.id, targetContextKey);
            if (op.parentId) addChildToLocalParent(op.parentId, op.component.id);
          }

          await sleepForReact();
        } else if (op.op === "setBindings" && op.componentId && op.bindings) {
          updateComponent(op.componentId, { bindings: op.bindings });
          const component = componentById.get(op.componentId);
          if (component) {
            componentById.set(op.componentId, { ...component, bindings: op.bindings });
          }
          await sleepForReact();
        } else if (op.op === "updateCustomModulesCode" && typeof op.customModulesCode === "string") {
          setAppDetails((previous) => ({
            ...previous,
            customModulesCode: op.customModulesCode!,
          }));
          await sleepForReact();
        } else if (op.op === "addWorkflow" && op.workflow) {
          setWorkflowDefinition((current) => ({
            ...current,
            workflows: [
              ...current.workflows.filter(
                (workflow) =>
                  workflow.codeName !== op.workflow!.codeName &&
                  workflowTriggerKey(workflow) !== workflowTriggerKey(op.workflow!),
              ),
              op.workflow!,
            ],
          }));
          await sleepForReact();
        } else if (op.op === "deleteWorkflow" && op.componentId) {
          const codeNameToDelete = op.componentId;
          setWorkflowDefinition((current) => ({
            ...current,
            workflows: current.workflows.filter(
              (workflow) => workflow.codeName !== codeNameToDelete,
            ),
          }));
          await sleepForReact();
        } else {
          throw new Error(`AI returned an unsupported operation: ${op.op}`);
        }
      }
    },
    [
      addComponent,
      allComponents,
      componentOwnershipIndexes,
      handleAddModal,
      modals,
      moveComponent,
      removeComponentWithTab,
      setAppDetails,
      setWorkflowDefinition,
      updateComponent,
    ],
  );

  return applyAiCanvasOperations;
};
