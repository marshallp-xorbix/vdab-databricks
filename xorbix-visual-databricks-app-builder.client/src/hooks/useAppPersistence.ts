import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import { appApi } from "../providers/AppApi";
import type { VdabComponent } from "../types/components";
import type { AppComponentDto, UpsertAppComponentRequest } from "../models";
import { ApiError } from "../models";
import {
  getModalContextKey,
  getModalIdFromContextKey,
  isModalContextKey,
  type ComponentContexts,
  type EditorTab,
} from "../types/editor";
import { ComponentCategory } from "../types/components/componentTypes";
import { TabType } from "../types/editor";
import { mapDtoToComponent } from "../utils/appBuilderMapping";
import type { ComponentRegistryResponse } from "../providers/CanvasApi";
import type { WorkflowDefinition } from "../types/workflow";
import { EMPTY_WORKFLOW_DEFINITION } from "../types/workflow";
import {
  applyCodeNamesToLoadedComponents,
  normalizeCodeName,
} from "../utils/codeNameUtils";
import {
  normalizeComponentHeightPixels,
  normalizeComponentsHeightPixels,
} from "../utils/componentProps/heightPixelsUtils";
import { validateComponentsForSave } from "../utils/layoutUtils";
import { useLogger } from "../logger/useLogger";

/**
 * Editable app-level metadata tracked in the builder and persisted on save.
 */
export interface AppDetails {
  appName: string;
  databricksAppName: string;
  description: string;
  workspacePath: string;
  workspaceConnectionId: string;
  version: number;
  lastPublishedAt?: string;
  /** Source for generated `custom_modules.py`; synced from the API and saved on update. */
  customModulesCode: string;
}

const getLayoutSortY = (layoutJson?: string): number => {
  if (!layoutJson) return Number.MAX_SAFE_INTEGER;

  try {
    const layout = JSON.parse(layoutJson);
    return layout?.y ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const buildComponentIdMap = (
  contexts: ComponentContexts,
  modals: VdabComponent[],
  fallback?: Map<string, number>,
): Map<string, number> => {
  const newMap = new Map<string, number>();

  Object.values(contexts).forEach((contextComponents) => {
    contextComponents.forEach((comp) => {
      const parsed = Number.parseInt(comp.id, 10);
      if (!Number.isNaN(parsed)) {
        newMap.set(comp.id, parsed);
      }
    });
  });

  modals.forEach((modal) => {
    const parsed = Number.parseInt(modal.id, 10);
    if (!Number.isNaN(parsed)) {
      newMap.set(modal.id, parsed);
    }
  });

  if (fallback) {
    fallback.forEach((backendId, frontendId) => {
      if (!newMap.has(frontendId)) {
        newMap.set(frontendId, backendId);
      }
    });
  }

  return newMap;
};

interface ComponentSavePayload {
  frontendId: string;
  request: UpsertAppComponentRequest;
}

export const buildComponentSavePayloads = (
  components: VdabComponent[],
  componentIdMap: Map<string, number>,
): ComponentSavePayload[] =>
  components.map((comp) => {
    const backendId = componentIdMap.get(comp.id);
    const request: UpsertAppComponentRequest = {
      id: backendId,
      frontendId: comp.id,
      codeName: normalizeCodeName(comp.codeName),
      componentType: comp.type,
      componentVersion: comp.schemaVersion || 1,
      properties: JSON.stringify(comp.props),
      bindings: comp.bindings ? JSON.stringify(comp.bindings) : undefined,
      children: comp.children ? JSON.stringify(comp.children) : undefined,
      layout: comp.layout,
    };

    return {
      frontendId: comp.id,
      request,
    };
  });

const buildFrontendToBackendIdMap = (
  payloads: ComponentSavePayload[],
  savedComponents: AppComponentDto[],
  existingIdMap: Map<string, number>,
): Map<string, string> => {
  const frontendToBackendId = new Map<string, string>();

  payloads.forEach((payload) => {
    if (payload.request.id) {
      frontendToBackendId.set(
        payload.frontendId,
        payload.request.id.toString(),
      );
    }
  });

  existingIdMap.forEach((backendId, frontendId) => {
    if (!frontendToBackendId.has(frontendId)) {
      frontendToBackendId.set(frontendId, backendId.toString());
    }
  });

  savedComponents.forEach((savedComponent) => {
    if (!savedComponent.frontendId) {
      return;
    }

    frontendToBackendId.set(
      savedComponent.frontendId,
      savedComponent.id.toString(),
    );
  });

  const unresolvedFrontendIds = payloads
    .map((payload) => payload.frontendId)
    .filter((frontendId) => !frontendToBackendId.has(frontendId));

  if (unresolvedFrontendIds.length > 0) {
    throw new Error(
      `Could not deterministically map saved components for frontend IDs: ${unresolvedFrontendIds.join(", ")}`,
    );
  }

  return frontendToBackendId;
};

const resolveFrontendId = (id: string, idMap: Map<string, string>): string =>
  idMap.get(id) ?? id;

const resolveBackendIdString = (
  id: string,
  idMap: Map<string, string>,
): string => idMap.get(id) ?? id;

const resolveBackendIdNumber = (
  id: string,
  idMap: Map<string, string>,
): number | undefined => {
  const value = resolveBackendIdString(id, idMap);
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const mapChildrenToFrontendIds = (
  children: string[] | undefined,
  idMap: Map<string, string>,
): string[] | undefined =>
  children?.map((childId) => resolveFrontendId(childId, idMap));

const mapChildrenToBackendIds = (
  children: string[] | undefined,
  idMap: Map<string, string>,
): string[] | undefined =>
  children?.map((childId) => resolveBackendIdString(childId, idMap));

const getApiErrorDetails = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Unknown error";
  }

  const { status, data } = error;
  const prefix = `HTTP ${status}`;

  if (Array.isArray(data) && data.length > 0) {
    const firstError = data[0] as
      | string
      | { message?: string; Message?: string };
    if (typeof firstError === "string") {
      return `${prefix}: ${firstError}`;
    }

    if (firstError?.message) {
      return `${prefix}: ${firstError.message}`;
    }

    if (firstError?.Message) {
      return `${prefix}: ${firstError.Message}`;
    }
  }

  if (typeof data === "string") {
    return `${prefix}: ${data}`;
  }

  return `${prefix}: ${error.message}`;
};

interface UseAppPersistenceParams {
  appId: number | null;
  registry: ComponentRegistryResponse | null;
  getAllComponents: () => VdabComponent[];
  componentContexts: ComponentContexts;
  componentIdMap: Map<string, number>;
  deletedComponentIds: Set<number>;
  selectedComponentId: string | null;
  openTabsRef: RefObject<EditorTab[]>;
  activeTabIdRef: RefObject<string>;
  setComponentContexts: (contexts: ComponentContexts) => void;
  setModals: (modals: VdabComponent[]) => void;
  replaceTabs: (tabs: EditorTab[]) => void;
  setActiveTabId: (tabId: string) => void;
  setComponentIdMap: (map: Map<string, number>) => void;
  setAppTheme: (theme: Record<string, string>) => void;
  setWorkflowDefinition: (workflowDefinition: WorkflowDefinition) => void;
  setSelectedComponentId: (id: string | null) => void;
  setDeletedComponentIds: (ids: Set<number>) => void;
  modals: VdabComponent[];
  workflowDefinition: WorkflowDefinition;
  appDetails: AppDetails;
  setAppDetails: (details: AppDetails) => void;
  appTheme: Record<string, string>;
}

interface UseAppPersistenceResult {
  loading: boolean;
  handleSave: () => Promise<void>;
  reload: () => Promise<void>;
  workspaceConnectionId: number | null;
}

export function useAppPersistence({
  appId,
  registry,
  getAllComponents,
  componentContexts,
  componentIdMap,
  deletedComponentIds,
  selectedComponentId,
  openTabsRef,
  activeTabIdRef,
  setComponentContexts,
  setModals,
  replaceTabs,
  setActiveTabId,
  setComponentIdMap,
  setAppTheme,
  setWorkflowDefinition,
  setSelectedComponentId,
  setDeletedComponentIds,
  modals,
  workflowDefinition,
  appDetails,
  setAppDetails,
  appTheme,
}: UseAppPersistenceParams): UseAppPersistenceResult {
  const logger = useLogger("useAppPersistence");
  const [loading, setLoading] = useState(false);
  const [workspaceConnectionId, setWorkspaceConnectionId] = useState<
    number | null
  >(null);

  const loadAppData = useCallback(async () => {
    if (!appId || !registry) return;

    try {
      setLoading(true);
      let appData;
      try {
        appData = await appApi.getAppById(appId);
      } catch (error) {
        logger.UI.error(
          `Failed to load app metadata from /api/App/${appId}: ${getApiErrorDetails(error)}`,
          error,
        );
        throw error;
      }

      let backendContexts;
      try {
        backendContexts = await appApi.getComponentsByAppId(appId);
      } catch (error) {
        logger.UI.error(
          `Failed to load app components from /api/AppComponent/app/${appId}: ${getApiErrorDetails(error)}`,
          error,
        );
        throw error;
      }

      setWorkspaceConnectionId(appData.workspaceConnectionId || null);

      // Populate appDetails from the loaded data.
      setAppDetails({
        appName: appData.appName,
        databricksAppName: appData.databricksAppName || "",
        description: appData.description || "",
        workspacePath: appData.workspacePath || "",
        workspaceConnectionId:
          appData.workspaceConnectionId > 0
            ? appData.workspaceConnectionId.toString()
            : "",
        version: appData.version,
        lastPublishedAt: appData.lastPublishedAt,
        customModulesCode: appData.customModulesCode ?? "",
      });

      if (appData.workflowDefinition) {
        try {
          setWorkflowDefinition(
            JSON.parse(appData.workflowDefinition) as WorkflowDefinition,
          );
        } catch {
          setWorkflowDefinition(EMPTY_WORKFLOW_DEFINITION);
        }
      } else {
        setWorkflowDefinition(EMPTY_WORKFLOW_DEFINITION);
      }

      let themeObj: Record<string, string> = {};
      if (appData.theme) {
        try {
          themeObj = JSON.parse(appData.theme);
        } catch {
          logger.UI.warn("Invalid theme JSON, ignoring.");
        }
      }

      setAppTheme(themeObj);

      const processedContexts: ComponentContexts = {};
      const loadedModals: VdabComponent[] = [];

      const modalDtos = backendContexts["__modals"] || [];
      modalDtos.forEach((modalDto) => {
        const modal = mapDtoToComponent(modalDto, registry);
        loadedModals.push(modal);
      });

      Object.entries(backendContexts).forEach(([contextKey, dtoList]) => {
        if (contextKey === "__modals") return;

        const sortedDtos = [...dtoList].sort((a, b) => {
          const aY = getLayoutSortY(a.layout);
          const bY = getLayoutSortY(b.layout);
          return aY - bY;
        });

        processedContexts[contextKey] = sortedDtos.map((dto) => {
          return mapDtoToComponent(dto, registry);
        });
      });

      const componentsWithCodeNames = applyCodeNamesToLoadedComponents(
        processedContexts,
        loadedModals,
      );

      const newMap = buildComponentIdMap(
        componentsWithCodeNames.componentContexts,
        componentsWithCodeNames.modals,
      );
      setComponentIdMap(newMap);
      setComponentContexts(componentsWithCodeNames.componentContexts);
      setModals(componentsWithCodeNames.modals);
    } catch (error) {
      logger.UI.error(
        `Failed to load app data: ${getApiErrorDetails(error)}`,
        error,
      );
    } finally {
      setLoading(false);
    }
  }, [
    appId,
    registry,
    setAppDetails,
    setAppTheme,
    setComponentContexts,
    setComponentIdMap,
    setModals,
    setWorkflowDefinition,
    setWorkspaceConnectionId,
  ]);

  useEffect(() => {
    if (!appId || !registry) return;
    loadAppData();
  }, [appId, registry, loadAppData]);

  const handleSave = useCallback(async () => {
    if (!appId) {
      throw new Error("App ID is required to save");
    }

    try {
      const currentTabs = openTabsRef.current;
      const currentActiveTabId = activeTabIdRef.current;

      if (deletedComponentIds.size > 0) {
        const deletePromises = Array.from(deletedComponentIds).map((id) =>
          appApi.deleteComponent(id),
        );
        await Promise.all(deletePromises);
        setDeletedComponentIds(new Set());
      }

      const allComponents = normalizeComponentsHeightPixels(getAllComponents());
      validateComponentsForSave(allComponents);

      const payloads = buildComponentSavePayloads(
        allComponents,
        componentIdMap,
      );

      const savedComponents = await appApi.upsertComponents(
        appId,
        payloads.map((payload) => payload.request),
      );

      const themeJson = JSON.stringify(appTheme);

      await appApi.updateApp(appId, {
        appName: appDetails.appName,
        databricksAppName: appDetails.databricksAppName || undefined,
        description: appDetails.description || undefined,
        workspaceConnectionId: appDetails.workspaceConnectionId
          ? Number.parseInt(appDetails.workspaceConnectionId, 10)
          : 0,
        workspacePath: appDetails.workspacePath || undefined,
        version: appDetails.version,
        lastPublishedAt: appDetails.lastPublishedAt,
        theme: themeJson,
        workflowDefinition: JSON.stringify(workflowDefinition),
        customModulesCode: appDetails.customModulesCode,
      });

      const frontendToBackendId = buildFrontendToBackendIdMap(
        payloads,
        savedComponents,
        componentIdMap,
      );

      const updatedContexts: ComponentContexts = {};

      Object.entries(componentContexts).forEach(([contextKey, components]) => {
        updatedContexts[contextKey] = components.map((comp) => {
          const newId = resolveFrontendId(comp.id, frontendToBackendId);
          const updatedChildren = mapChildrenToFrontendIds(
            comp.children,
            frontendToBackendId,
          );
          return normalizeComponentHeightPixels({
            ...comp,
            id: newId,
            children: updatedChildren,
          });
        });
      });

      const finalContexts: ComponentContexts = {};
      Object.entries(updatedContexts).forEach(([contextKey, components]) => {
        if (isModalContextKey(contextKey)) {
          const oldModalId = getModalIdFromContextKey(contextKey);
          if (!oldModalId) {
            finalContexts[contextKey] = components;
            return;
          }
          const newModalId = resolveFrontendId(oldModalId, frontendToBackendId);
          finalContexts[getModalContextKey(newModalId)] = components;
        } else {
          finalContexts[contextKey] = components;
        }
      });

      const updatedTabs = currentTabs.map((tab) => {
        if (tab.type === TabType.MainFlow || tab.type === TabType.MainPage) {
          return tab;
        }

        if (tab.type === TabType.Modal && tab.modalId) {
          const newModalId = resolveFrontendId(
            tab.modalId,
            frontendToBackendId,
          );
          return {
            ...tab,
            modalId: newModalId,
            id: `modal-${newModalId}`,
          };
        }

        return tab;
      });

      let updatedActiveTabId = currentActiveTabId;
      if (
        updatedActiveTabId === "main-flow" ||
        updatedActiveTabId === "main-page"
      ) {
        // Keep as is
      } else if (updatedActiveTabId.startsWith("modal-")) {
        const originalModalId = updatedActiveTabId.replace("modal-", "");
        const newModalId = resolveFrontendId(
          originalModalId,
          frontendToBackendId,
        );
        updatedActiveTabId = `modal-${newModalId}`;
      }

      if (selectedComponentId) {
        const newSelectedId = resolveFrontendId(
          selectedComponentId,
          frontendToBackendId,
        );
        setSelectedComponentId(newSelectedId);
      }

      const updatedModals = modals.map((modal) => {
        const newId = resolveFrontendId(modal.id, frontendToBackendId);

        const updatedChildren = mapChildrenToBackendIds(
          modal.children,
          frontendToBackendId,
        )?.map((childId) => {
          const backendId = resolveBackendIdNumber(
            childId,
            frontendToBackendId,
          );
          if (!backendId) {
            logger.UI.warn(
              "[MODAL_LIFECYCLE] Could not find backend ID for child:",
              childId,
            );
            return childId;
          }
          return backendId.toString();
        });
        return normalizeComponentHeightPixels({
          ...modal,
          id: newId,
          children: updatedChildren,
        });
      });

      const allContextComponents = Object.values(finalContexts).flat();
      const layoutComponents = allContextComponents.filter(
        (comp) => comp.category === ComponentCategory.Layout && comp.children,
      );

      const updatedLayoutComponents = layoutComponents.map((layout) => {
        const newId = resolveFrontendId(layout.id, frontendToBackendId);

        const updatedChildren = mapChildrenToBackendIds(
          layout.children,
          frontendToBackendId,
        )?.map((childId) => {
          const backendId = resolveBackendIdNumber(
            childId,
            frontendToBackendId,
          );
          if (!backendId) {
            logger.UI.warn(
              "[LAYOUT_LIFECYCLE] Could not find backend ID for child:",
              childId,
            );
            return childId;
          }
          return backendId.toString();
        });

        return {
          ...layout,
          id: newId,
          children: updatedChildren,
        };
      });

      const reverseIdMap = new Map<string, string>();
      frontendToBackendId.forEach((newId, oldId) => {
        reverseIdMap.set(newId, oldId);
      });

      const modalsNeedingResave = updatedModals.filter((modal) => {
        const originalId = reverseIdMap.get(modal.id) || modal.id;
        const originalModal = allComponents.find((c) => c.id === originalId);
        return (
          originalModal &&
          JSON.stringify(originalModal.children) !==
            JSON.stringify(modal.children)
        );
      });

      const layoutsNeedingResave = updatedLayoutComponents.filter((layout) => {
        const originalId = reverseIdMap.get(layout.id) || layout.id;
        const originalLayout = allComponents.find((c) => c.id === originalId);
        return (
          originalLayout &&
          JSON.stringify(originalLayout.children) !==
            JSON.stringify(layout.children)
        );
      });

      const componentsNeedingResave = [
        ...modalsNeedingResave.map((modal) => ({
          component: modal,
          backendId: resolveBackendIdNumber(modal.id, frontendToBackendId),
        })),
        ...layoutsNeedingResave.map((layout) => ({
          component: layout,
          backendId: resolveBackendIdNumber(layout.id, frontendToBackendId),
        })),
      ];

      const uniqueResaveComponents = new Map<number, VdabComponent>();
      componentsNeedingResave.forEach(({ component, backendId }) => {
        if (!backendId) return;
        uniqueResaveComponents.set(backendId, component);
      });

      if (uniqueResaveComponents.size > 0) {
        const resaveRequests: UpsertAppComponentRequest[] = Array.from(
          uniqueResaveComponents.entries(),
        ).map(([backendId, component]) => ({
          id: backendId,
          codeName: normalizeCodeName(component.codeName),
          componentType: component.type,
          componentVersion: component.schemaVersion || 1,
          properties: JSON.stringify(component.props),
          bindings: component.bindings
            ? JSON.stringify(component.bindings)
            : undefined,
          children: component.children
            ? JSON.stringify(component.children)
            : undefined,
          layout: component.layout,
        }));

        await appApi.upsertComponents(appId, resaveRequests);
      }

      const refreshedComponentIdMap = buildComponentIdMap(
        finalContexts,
        updatedModals,
        componentIdMap,
      );
      setComponentIdMap(refreshedComponentIdMap);
      setComponentContexts(finalContexts);
      setModals(updatedModals);
      replaceTabs(updatedTabs);
      setActiveTabId(updatedActiveTabId);
    } catch (error) {
      logger.UI.error("Failed to save changes:", error);
      throw error;
    }
  }, [
    appId,
    activeTabIdRef,
    openTabsRef,
    deletedComponentIds,
    componentIdMap,
    componentContexts,
    getAllComponents,
    modals,
    selectedComponentId,
    setActiveTabId,
    setComponentContexts,
    setComponentIdMap,
    setDeletedComponentIds,
    setModals,
    setSelectedComponentId,
    replaceTabs,
    workflowDefinition,
    appDetails,
    appTheme,
    logger,
  ]);

  return {
    loading,
    handleSave,
    reload: loadAppData,
    workspaceConnectionId,
  };
}
