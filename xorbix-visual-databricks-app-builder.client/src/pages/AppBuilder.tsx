import {
  lazy,
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useBlocker } from "react-router";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useSearchParams, useParams } from "react-router-dom";
import AppCanvasArea from "../components/AppBuilderComponents/AppCanvas/AppCanvasArea";
import RightSidebar from "../components/AppBuilderComponents/AppBuilderPanels/RightSidebar";
import BuilderHeader from "../components/AppBuilderComponents/BuilderHeader";
import BuilderLeftPanel from "../components/AppBuilderComponents/AppBuilderPanels/BuilderLeftPanel";
import TabBar from "../components/AppBuilderComponents/TabBar";
import { useComponentRegistry } from "../context/ComponentRegistryContext";
import { useBuilderLayout } from "../context/BuilderLayoutContext";
import type { Binding } from "../types/components/bindings";
import type { VdabComponent } from "../types/components/vdabComponent";
import {
  ComponentType,
} from "../types/components/componentTypes";
import type { ComponentDragData } from "../types/dnd";
import { readComponentDragData } from "../utils/dndPayload";
import {
  CanvasContextType,
  TabType,
} from "../types/editor";
import {
  clampPageWidth,
  getPageWidthFromTheme,
  PAGE_WIDTH_THEME_KEY,
} from "../utils/pageWidthDefaults";
import {
  getStreamlitThemeDefaults,
} from "../components/AppBuilderComponents/AppSettingsTab/themeDefaults";
import { useTheme } from "../context/ThemeContext";
import { useTabManagement } from "../hooks/useTabManagement";
import { useComponentOperations } from "../hooks/useComponentOperations";
import { useAppPersistence } from "../hooks/useAppPersistence";
import type { AppDetails } from "../hooks/useAppPersistence";
import { useComponentDragDrop } from "../hooks/useComponentDragDrop";
import { useApplyAiCanvasOperations } from "../hooks/useApplyAiCanvasOperations";
import { codeApi } from "../providers/CodeApi";
import { ApiError, type ICodePreviewFile } from "../models";
import { toast } from "../components/ui/use-toast";
import { chooseDefaultCodeFilePath } from "../utils/codePreviewUtils";
import type { RemoveComponentOptions } from "../types/components/componentRemoval";
import type { WorkflowDefinition } from "../types/workflow";
import { EMPTY_WORKFLOW_DEFINITION } from "../types/workflow";
import type { WorkflowFocusRequest } from "../types/workflow";
import {
  removeWorkflowsForComponentIds,
  removeWorkflowsWithMissingTriggers,
  renameWorkflowComponentReferences,
} from "../components/AppBuilderComponents/Workflow/workflowPanelUtils";
import { databricksApi } from "../providers/DatabricksApi";
import type { DatabricksConnection } from "../models";
import { useAppSettingsData } from "../hooks/useAppSettingsData";
import { getGenieChatDeployBlockingMessage } from "../utils/genieChatValidation";
import { getModelChatDeployBlockingMessage } from "../utils/modelChatValidation";
import { normalizeComponentsHeightPixels } from "../utils/componentProps/heightPixelsUtils";
import { getLayoutTabIndex } from "../utils/layoutUtils";
import { nestedLayoutFirstCollisionDetection } from "../utils/componentDragCollision";

const MainFlowView = lazy(
  () => import("../components/AppBuilderComponents/AppCanvas/MainFlowView"),
);
const CodeTabView = lazy(
  () => import("../components/AppBuilderComponents/AppCanvas/CodeTabView"),
);
const WorkflowBuilderView = lazy(
  () =>
    import("../components/AppBuilderComponents/AppCanvas/WorkflowBuilderView"),
);
const AppSettingsTab = lazy(
  () =>
    import("../components/AppBuilderComponents/AppSettingsTab/AppSettingsTab"),
);
const AiBuilderChat = lazy(
  () => import("../components/AppBuilderComponents/AIBuilderChatWindow"),
);

/**
 * Backend preview deserialization expects PascalCase component keys (Id/Type/Category/etc.)
 * because the custom converter reads exact property names.
 */
const transformComponentsForCodePreviewApi = (components: VdabComponent[]) => {
  return normalizeComponentsHeightPixels(components).map((component) => ({
    Id: component.id,
    CodeName: component.codeName,
    Type: component.type,
    Category: component.category,
    Props: component.props,
    Bindings: component.bindings,
    SupportedBindings: component.supportedBindings,
    SupportedEvents: component.supportedEvents,
    Children: component.children,
    Layout: component.layout,
    SchemaVersion: component.schemaVersion,
  }));
};

const getAncestorDirectoryPaths = (filePath: string): string[] => {
  const segments = filePath.split("/").filter((segment) => segment.length > 0);
  if (segments.length <= 1) {
    return [];
  }

  const directories: string[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    const directoryPath = segments.slice(0, index + 1).join("/");
    directories.push(directoryPath);
  }

  return directories;
};

const getApiErrorDescription = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof ApiError) {
    const data = error.data as
      | { detail?: unknown; errors?: unknown; title?: unknown }
      | undefined;

    if (typeof data?.detail === "string" && data.detail.length > 0) {
      return data.detail;
    }

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.filter(Boolean).join(" ");
    }

    if (typeof data?.title === "string" && data.title.length > 0) {
      return data.title;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

const collectComponentIdsForRemoval = (
  components: VdabComponent[],
  componentId: string,
  options?: RemoveComponentOptions,
): Set<string> => {
  const ids = new Set<string>([componentId]);

  if (options?.mode !== "deleteSubtree") {
    return ids;
  }

  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );

  const visit = (id: string) => {
    const component = componentsById.get(id);
    component?.children?.forEach((childId) => {
      if (ids.has(childId)) {
        return;
      }

      ids.add(childId);
      visit(childId);
    });
  };

  visit(componentId);
  return ids;
};

const collectTabsTabChildIds = (
  components: VdabComponent[],
  tabsComponentId: string,
  tabIndex: number,
): Set<string> => {
  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );
  const tabsComponent = componentsById.get(tabsComponentId);
  const ids = new Set<string>();

  tabsComponent?.children?.forEach((childId) => {
    const child = componentsById.get(childId);
    if (!child || getLayoutTabIndex(child.layout) !== tabIndex) {
      return;
    }

    ids.add(childId);
    collectComponentIdsForRemoval(components, childId, {
      mode: "deleteSubtree",
    }).forEach((descendantId) => ids.add(descendantId));
  });

  return ids;
};

function BuilderModeFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Loading builder view...
    </div>
  );
}

export default function AppBuilder() {
  const params = useParams<{ appId?: string }>();
  const [searchParams] = useSearchParams();
  const appId = params.appId ? parseInt(params.appId, 10) : null;
  const nameParam = searchParams.get("name");
  const appName = nameParam ? decodeURIComponent(nameParam) : "App1";

  const { registry } = useComponentRegistry();
  const {
    builderMode,
    setBuilderMode,
    isLeftPanelOpen,
    setIsLeftPanelOpen,
    isRightPanelOpen,
    setIsRightPanelOpen,
    setHeaderAppTitle,
  } = useBuilderLayout();

  const { theme: productTheme } = useTheme();
  const [appTheme, setAppTheme] = useState<Record<string, string>>({});
  /** Canvas / preview theme with product-theme defaults filled in for unset keys. */
  const resolvedAppTheme = useMemo(
    () => ({
      ...getStreamlitThemeDefaults(productTheme),
      ...appTheme,
    }),
    [appTheme, productTheme],
  );
  const [appDetails, setAppDetails] = useState<AppDetails>({
    appName: appName,
    databricksAppName: "",
    description: "",
    workspacePath: "",
    workspaceConnectionId: "",
    version: 1,
    customModulesCode: "",
  });
  const [workflowDefinition, setWorkflowDefinition] =
    useState<WorkflowDefinition>(EMPTY_WORKFLOW_DEFINITION);
  const [workflowFocusRequest, setWorkflowFocusRequest] =
    useState<WorkflowFocusRequest | null>(null);
  const [appSettingsResourcesDirty, setAppSettingsResourcesDirty] =
    useState(false);

  const resourcesNavigationBlocker = useBlocker(appSettingsResourcesDirty);

  useEffect(() => {
    if (resourcesNavigationBlocker.state !== "blocked") {
      return;
    }
    const leave = window.confirm(
      "You have unsaved resource changes. Leave without saving?",
    );
    if (leave) {
      resourcesNavigationBlocker.proceed();
    } else {
      resourcesNavigationBlocker.reset();
    }
  }, [resourcesNavigationBlocker, resourcesNavigationBlocker.state]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!appSettingsResourcesDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [appSettingsResourcesDirty]);

  const [showAiChat, setShowAiChat] = useState(false);
  const [activeDragData, setActiveDragData] =
    useState<ComponentDragData | null>(null);
  const [codePreviewFiles, setCodePreviewFiles] = useState<ICodePreviewFile[]>(
    [],
  );
  const [codePreviewErrors, setCodePreviewErrors] = useState<string[]>([]);
  const [prebuiltModulesLibrarySource, setPrebuiltModulesLibrarySource] =
    useState<string>("");
  const [codePreviewLoading, setCodePreviewLoading] = useState(false);
  const [selectedCodeFilePath, setSelectedCodeFilePath] = useState<
    string | null
  >(null);
  const [codeTreeOpenState, setCodeTreeOpenState] = useState<
    Record<string, boolean>
  >({});
  const [codeTreeExplicitlyClosed, setCodeTreeExplicitlyClosed] = useState<
    Record<string, boolean>
  >({});

  const closeTabRef = useRef<(tabId: string) => void>(() => {});

  const {
    componentContexts,
    setComponentContexts,
    modals,
    setModals,
    componentIdMap,
    setComponentIdMap,
    deletedComponentIds,
    setDeletedComponentIds,
    selectedComponentId,
    setSelectedComponentId,
    getAllComponents,
    componentOwnershipIndexes,
    findComponent,
    updateComponent,
    addComponent,
    removeComponentWithTab,
    moveComponent,
    handleAddModal,
    removeTabFromTabsComponent,
  } = useComponentOperations({ closeTabRef });

  const allComponents = useMemo(() => getAllComponents(), [getAllComponents]);

  const handleAiOperations = useApplyAiCanvasOperations({
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
  });

  const [tenantWorkspaceConnections, setTenantWorkspaceConnections] = useState<
    DatabricksConnection[]
  >([]);

  useEffect(() => {
    if (!appId) {
      return;
    }

    let cancelled = false;
    void databricksApi
      .getWorkspacesByTenant()
      .then((connections) => {
        if (!cancelled) {
          setTenantWorkspaceConnections(connections);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantWorkspaceConnections([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  const resolvedWorkspaceUrl = useMemo((): string | null => {
    const raw = appDetails.workspaceConnectionId?.trim();
    if (!raw) {
      return null;
    }

    const connectionId = parseInt(raw, 10);
    if (Number.isNaN(connectionId) || connectionId <= 0) {
      return null;
    }

    const match = tenantWorkspaceConnections.find(
      (c) => c.pkId === connectionId,
    );
    const url = match?.workspaceUrl?.trim();
    return url && url.length > 0 ? url : null;
  }, [appDetails.workspaceConnectionId, tenantWorkspaceConnections]);

  const {
    workspaceConnections: appSettingsWorkspaceConnections,
    normalizedResources: appSettingsNormalizedResources,
    appSettingsWarnings,
    appSettingsComputeSize,
    databricksAppUpdateTime,
    resourcesLoading: appSettingsResourcesLoading,
    resourcesError: appSettingsResourcesError,
    reloadDatabricksResources,
  } = useAppSettingsData({
    databricksAppName: appDetails.databricksAppName?.trim() ?? "",
    appId,
  });

  const {
    openTabs,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    syncModalTabLabels,
    replaceTabs,
  } = useTabManagement({
    findComponent,
    onTabClosed: () => setSelectedComponentId(null),
  });

  // Refs to store latest state for save function
  const openTabsRef = useRef(openTabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    closeTabRef.current = closeTab;
  }, [closeTab]);

  // Auto-switch to Settings mode when ?settings=true is in the URL
  useEffect(() => {
    if (searchParams.get("settings") === "true") {
      setBuilderMode("settings");
    }
    // Only run on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fromDetails = appDetails.appName?.trim();
    setHeaderAppTitle(fromDetails || appName || "App");
  }, [appDetails.appName, appName, setHeaderAppTitle]);

  useEffect(() => {
    if (!appId) {
      setPrebuiltModulesLibrarySource("");
      return;
    }

    void codeApi
      .getPrebuiltModulesLibrary()
      .then((text) => {
        if (typeof text === "string") {
          setPrebuiltModulesLibrarySource(text);
        }
      })
      .catch(() => {
        // Non-fatal: Call Prebuilt Module editor shows a reload hint when empty.
      });
  }, [appId]);

  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const selectedComponent = findComponent(selectedComponentId || "");

  // Only canvas tabs (MainFlow, MainPage, Modal) are shown in the tab bar
  const canvasTabs = useMemo(
    () =>
      openTabs.filter(
        (tab) =>
          tab.type === TabType.MainFlow ||
          tab.type === TabType.MainPage ||
          tab.type === TabType.Modal,
      ),
    [openTabs],
  );

  const isCanvasView =
    builderMode === "canvas" && activeTab?.type !== TabType.MainFlow;
  const dragContextType =
    activeTab?.type === TabType.Modal
      ? CanvasContextType.Modal
      : CanvasContextType.Page;

  const {
    dropIndicator,
    layoutDropBlocked,
    handleDragStart,
    handleDragMove,
    handleDragCancel,
    handleDragEnd,
  } = useComponentDragDrop({
    registry,
    formComponents: allComponents,
    contextType: dragContextType,
    modalId: activeTab?.type === TabType.Modal ? activeTab.modalId : undefined,
    isEnabled: !!isCanvasView,
    onMoveComponent: moveComponent,
    onAddComponent: addComponent,
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStartWithOverlay = useCallback(
    (event: DragStartEvent) => {
      const dragData = readComponentDragData(event.active.data.current);
      if (dragData) {
        setActiveDragData(dragData);
      }
      handleDragStart(event);
    },
    [handleDragStart],
  );

  const handleDragEndWithOverlay = useCallback(
    (event: DragEndEvent) => {
      handleDragEnd(event);
      setActiveDragData(null);
    },
    [handleDragEnd],
  );

  const handleDragCancelWithOverlay = useCallback(
    (event: DragCancelEvent) => {
      handleDragCancel(event);
      setActiveDragData(null);
    },
    [handleDragCancel],
  );

  const handleUpdateBindings = useCallback(
    (componentId: string, bindings: Record<string, Binding>): void => {
      updateComponent(componentId, { bindings });
    },
    [updateComponent],
  );

  const handleUpdateComponent = useCallback(
    (componentId: string, updates: Record<string, unknown>) => {
      const existingComponent = findComponent(componentId);
      const nextCodeName = updates.codeName;
      updateComponent(componentId, updates);

      if (
        existingComponent?.codeName &&
        typeof nextCodeName === "string" &&
        nextCodeName &&
        nextCodeName !== existingComponent.codeName
      ) {
        setWorkflowDefinition((current) =>
          renameWorkflowComponentReferences(
            current,
            existingComponent.codeName ?? "",
            nextCodeName,
            { isModal: existingComponent.type === ComponentType.Modal },
          ),
        );
      }
    },
    [findComponent, updateComponent],
  );

  const handleRemoveComponentWithWorkflowCleanup = useCallback(
    (componentId: string, options?: RemoveComponentOptions) => {
      const removedComponentIds = collectComponentIdsForRemoval(
        allComponents,
        componentId,
        options,
      );

      setWorkflowDefinition((current) =>
        removeWorkflowsForComponentIds(
          current,
          allComponents,
          removedComponentIds,
        ),
      );

      removeComponentWithTab(componentId, options);
    },
    [allComponents, removeComponentWithTab],
  );

  const handleDeleteModalWithWorkflowCleanup = useCallback(
    (modalId: string) => {
      handleRemoveComponentWithWorkflowCleanup(modalId, {
        mode: "deleteSubtree",
      });
    },
    [handleRemoveComponentWithWorkflowCleanup],
  );

  const handleDeleteTabWithWorkflowCleanup = useCallback(
    (tabsComponentId: string, tabIndex: number) => {
      const removedComponentIds = collectTabsTabChildIds(
        allComponents,
        tabsComponentId,
        tabIndex,
      );

      setWorkflowDefinition((current) =>
        removeWorkflowsForComponentIds(
          current,
          allComponents,
          removedComponentIds,
        ),
      );

      removeTabFromTabsComponent(tabsComponentId, tabIndex);
    },
    [allComponents, removeTabFromTabsComponent],
  );

  // AI Builder toggle handler
  const handleAiBuilderToggle = useCallback(() => {
    setShowAiChat((prev) => !prev);
  }, []);

  // Main Flow node click handler
  const handleMainFlowNodeClick = useCallback(
    (nodeId: string, nodeType: "page" | "modal") => {
      setBuilderMode("canvas");
      if (nodeType === "page") {
        openTab(TabType.MainPage);
      } else {
        const modal = findComponent(nodeId);
        const modalTitle =
          typeof modal?.props?.title === "string"
            ? modal.props.title
            : modal?.codeName;
        openTab(TabType.Modal, nodeId, modalTitle);
      }
    },
    [findComponent, openTab, setBuilderMode],
  );

  // Update tab labels when modal props change
  useEffect(() => {
    syncModalTabLabels();
  }, [componentContexts, syncModalTabLabels]);

  const loadingRef = useRef(false);

  const { loading, handleSave, reload, workspaceConnectionId } =
    useAppPersistence({
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
    });

  useEffect(() => {
    if (loading) {
      return;
    }

    setWorkflowDefinition((current) =>
      removeWorkflowsWithMissingTriggers(current, allComponents),
    );
  }, [allComponents, loading]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const appDetailsRef = useRef(appDetails);
  useEffect(() => {
    appDetailsRef.current = appDetails;
  }, [appDetails]);

  const fetchCodePreview = useCallback(async () => {
    if (!appId) {
      return;
    }

    setCodePreviewLoading(true);
    setCodePreviewErrors([]);

    try {
      const genieBlock = getGenieChatDeployBlockingMessage(
        allComponents,
        appSettingsNormalizedResources,
      );
      if (genieBlock) {
        toast({
          title: "Code preview blocked",
          description: genieBlock,
          variant: "destructive",
        });
        return;
      }

      const modelChatBlock = getModelChatDeployBlockingMessage(
        allComponents,
        appSettingsNormalizedResources,
      );
      if (modelChatBlock) {
        toast({
          title: "Code preview blocked",
          description: modelChatBlock,
          variant: "destructive",
        });
        return;
      }

      const previewRequest: Parameters<typeof codeApi.previewCode>[0] = {
        appName,
        appId,
        themeConfig: {
          primaryColor: resolvedAppTheme.primaryColor,
          backgroundColor: resolvedAppTheme.backgroundColor,
          secondaryBackgroundColor: resolvedAppTheme.secondaryBackgroundColor,
          textColor: resolvedAppTheme.textColor,
          pageWidth: getPageWidthFromTheme(resolvedAppTheme),
        },
        formComponents: transformComponentsForCodePreviewApi(allComponents),
        workflowDefinition,
      };

      if (!loadingRef.current) {
        previewRequest.customModulesCode = appDetailsRef.current.customModulesCode;
      }

      const previewResponse = await codeApi.previewCode(previewRequest);

      setCodePreviewFiles(previewResponse.files ?? []);
      setCodePreviewErrors(previewResponse.previewErrors ?? []);
      if (typeof previewResponse.prebuiltModulesLibrarySource === "string") {
        setPrebuiltModulesLibrarySource(
          previewResponse.prebuiltModulesLibrarySource,
        );
      }
      setSelectedCodeFilePath((previousPath) =>
        chooseDefaultCodeFilePath(previewResponse.files ?? [], previousPath),
      );
    } catch (error) {
      setCodePreviewErrors([]);
      toast({
        title: "Code preview failed",
        description: getApiErrorDescription(
          error,
          "Unable to load generated code preview.",
        ),
        variant: "destructive",
      });
    } finally {
      setCodePreviewLoading(false);
    }
  }, [
    allComponents,
    appId,
    appName,
    resolvedAppTheme,
    workflowDefinition,
    appSettingsNormalizedResources,
  ]);

  useEffect(() => {
    if (builderMode !== "code") {
      return;
    }

    void fetchCodePreview();
  }, [builderMode, fetchCodePreview]);

  const wasLoadingAppRef = useRef(loading);

  useEffect(() => {
    const wasLoading = wasLoadingAppRef.current;
    wasLoadingAppRef.current = loading;
    if (
      wasLoading &&
      !loading &&
      builderMode === "code" &&
      appId !== null &&
      appId !== undefined
    ) {
      void fetchCodePreview();
    }
  }, [loading, builderMode, appId, fetchCodePreview]);

  useEffect(() => {
    if (!selectedCodeFilePath) {
      return;
    }

    const ancestorDirectories = getAncestorDirectoryPaths(selectedCodeFilePath);
    if (ancestorDirectories.length === 0) {
      return;
    }

    setCodeTreeOpenState((previousState) => {
      const nextState = { ...previousState };
      let hasChanges = false;

      ancestorDirectories.forEach((directoryPath) => {
        if (codeTreeExplicitlyClosed[directoryPath]) {
          return;
        }

        if (!nextState[directoryPath]) {
          nextState[directoryPath] = true;
          hasChanges = true;
        }
      });

      return hasChanges ? nextState : previousState;
    });
  }, [selectedCodeFilePath, codeTreeExplicitlyClosed]);

  const handleCodeTreeToggle = useCallback(
    (directoryPath: string, isOpen: boolean) => {
      setCodeTreeOpenState((previousState) => ({
        ...previousState,
        [directoryPath]: isOpen,
      }));

      setCodeTreeExplicitlyClosed((previousState) => {
        if (isOpen) {
          if (!previousState[directoryPath]) {
            return previousState;
          }

          const nextState = { ...previousState };
          delete nextState[directoryPath];
          return nextState;
        }

        return {
          ...previousState,
          [directoryPath]: true,
        };
      });
    },
    [],
  );

  const handleJumpToWorkflowAction = useCallback(
    (workflowCodeName: string, nodeId?: string) => {
      setSelectedComponentId(null);
      setWorkflowFocusRequest({ workflowCodeName, nodeId });
      setBuilderMode("workflow");
    },
    [setBuilderMode, setSelectedComponentId],
  );

  const handleReload = useCallback(() => {
    if (builderMode === "code") {
      void fetchCodePreview();
      return;
    }

    reload();
    void reloadDatabricksResources();
  }, [builderMode, fetchCodePreview, reload, reloadDatabricksResources]);

  const handlePageWidthChange = useCallback(
    (nextWidth: number) => {
      const clampedWidth = clampPageWidth(nextWidth);
      setAppTheme((previousTheme) => ({
        ...previousTheme,
        [PAGE_WIDTH_THEME_KEY]: String(clampedWidth),
      }));
    },
    [],
  );

  const renderActiveView = () => {
    if (builderMode === "code") {
      return (
        <CodeTabView
          files={codePreviewFiles}
          selectedFilePath={selectedCodeFilePath}
          loading={codePreviewLoading}
          onSelectFile={setSelectedCodeFilePath}
          openState={codeTreeOpenState}
          onToggleDirectory={handleCodeTreeToggle}
          customModulesCode={appDetails.customModulesCode}
          onCustomModulesCodeChange={(next) =>
            setAppDetails((previous) => ({
              ...previous,
              customModulesCode: next,
            }))
          }
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          appMetaLoading={loading}
          previewErrors={codePreviewErrors}
        />
      );
    }

    if (builderMode === "workflow") {
      return (
        <WorkflowBuilderView
          components={allComponents}
          workflowDefinition={workflowDefinition}
          customModulesCode={appDetails.customModulesCode}
          prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          normalizedAppResources={appSettingsNormalizedResources}
          onChange={setWorkflowDefinition}
          focusRequest={workflowFocusRequest}
          onFocusHandled={() => setWorkflowFocusRequest(null)}
        />
      );
    }

    if (builderMode === "settings") {
      return (
        <AppSettingsTab
          appDetails={appDetails}
          onAppDetailsChange={setAppDetails}
          appTheme={appTheme}
          onAppThemeChange={setAppTheme}
          appId={appId}
          workspaceConnections={appSettingsWorkspaceConnections}
          normalizedResources={appSettingsNormalizedResources}
          appSettingsWarnings={appSettingsWarnings}
          appSettingsComputeSize={appSettingsComputeSize}
          databricksAppUpdateTime={databricksAppUpdateTime}
          resourcesLoading={appSettingsResourcesLoading}
          resourcesError={appSettingsResourcesError}
          reloadDatabricksResources={reloadDatabricksResources}
          onAppSettingsResourcesDirtyChange={setAppSettingsResourcesDirty}
          onSave={appId ? handleSave : undefined}
          onDiscard={appId ? reload : undefined}
        />
      );
    }

    // canvas mode — use active tab to determine view
    if (!activeTab || activeTab.type === TabType.MainFlow) {
      return (
        <MainFlowView
          formComponents={allComponents}
          workflowDefinition={workflowDefinition}
          onNodeClick={handleMainFlowNodeClick}
          onSelectComponent={setSelectedComponentId}
          onDeleteModal={handleDeleteModalWithWorkflowCleanup}
        />
      );
    }

    // Page or Modal canvas tab
    if (
      activeTab.type === TabType.MainPage ||
      activeTab.type === TabType.Modal
    ) {
      return (
        <AppCanvasArea
          formComponents={allComponents}
          contextType={
            activeTab.type === TabType.MainPage
              ? CanvasContextType.Page
              : CanvasContextType.Modal
          }
          modalId={activeTab.modalId}
          theme={resolvedAppTheme}
          onRemoveComponent={handleRemoveComponentWithWorkflowCleanup}
          selectedComponentId={selectedComponentId ?? null}
          onSelectComponent={setSelectedComponentId}
          dropIndicator={dropIndicator}
          layoutDropBlocked={layoutDropBlocked}
          workspaceUrl={resolvedWorkspaceUrl}
          pageWidth={
            activeTab.type === TabType.MainPage
              ? getPageWidthFromTheme(appTheme)
              : undefined
          }
        />
      );
    }

    // Fallback — show App Flow for any unexpected active tab type in canvas mode
    return (
      <MainFlowView
        formComponents={allComponents}
        workflowDefinition={workflowDefinition}
        onNodeClick={handleMainFlowNodeClick}
        onSelectComponent={setSelectedComponentId}
        onDeleteModal={handleDeleteModalWithWorkflowCleanup}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading app...</div>
      </div>
    );
  }

  const showRightSidebar = builderMode === "canvas" && isRightPanelOpen;
  const showLeftPanel = isLeftPanelOpen && builderMode === "canvas";
  const pageWidth = getPageWidthFromTheme(appTheme);
  const propertiesCanvasContextType =
    activeTab?.type === TabType.MainPage
      ? CanvasContextType.Page
      : CanvasContextType.Modal;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={nestedLayoutFirstCollisionDetection}
      onDragStart={handleDragStartWithOverlay}
      onDragMove={handleDragMove}
      onDragCancel={handleDragCancelWithOverlay}
      onDragEnd={handleDragEndWithOverlay}
    >
      <div className="flex h-full overflow-hidden relative">
        {/* Left Panel — component palette, add modal, or workflow list */}
        {showLeftPanel && (
          <div className="flex-shrink-0 w-60 overflow-hidden h-full">
            <BuilderLeftPanel
              builderMode={builderMode}
              activeTabType={activeTab?.type}
              onAddModal={handleAddModal}
              isDragActive={activeDragData !== null}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Builder toolbar */}
          <div className="flex-shrink-0">
            <BuilderHeader
              appId={appId}
              components={allComponents}
              workflowDefinition={workflowDefinition}
              onSave={appId ? handleSave : undefined}
              onAiBuilderClick={handleAiBuilderToggle}
              onReload={handleReload}
              normalizedAppResources={appSettingsNormalizedResources}
              onToggleLeftPanel={
                builderMode === "canvas"
                  ? () => setIsLeftPanelOpen(!isLeftPanelOpen)
                  : undefined
              }
              isLeftPanelOpen={isLeftPanelOpen}
              onToggleRightPanel={
                builderMode === "canvas"
                  ? () => setIsRightPanelOpen(!isRightPanelOpen)
                  : undefined
              }
              isRightPanelOpen={isRightPanelOpen}
            />
          </div>

          {/* Tab bar — canvas mode only */}
          {builderMode === "canvas" && (
            <div className="min-w-0 flex-shrink-0">
              <TabBar
                tabs={canvasTabs}
                activeTabId={activeTabId}
                onTabClick={setActiveTabId}
                onTabClose={closeTab}
              />
            </div>
          )}

          {/* Canvas / view area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <main className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
              <Suspense fallback={<BuilderModeFallback />}>
                {renderActiveView()}
              </Suspense>
            </main>
          </div>
        </div>

        {/* Right Sidebar — canvas mode only */}
        {showRightSidebar && (
          <div className="flex-shrink-0 w-80 h-full overflow-hidden">
            <RightSidebar
              selectedComponent={selectedComponent || null}
              components={allComponents}
              onUpdateComponent={handleUpdateComponent}
              onDeleteTab={handleDeleteTabWithWorkflowCleanup}
              onUpdateBindings={handleUpdateBindings}
              workflowDefinition={workflowDefinition}
              customModulesCode={appDetails.customModulesCode}
              prebuiltModulesLibrarySource={prebuiltModulesLibrarySource}
              onWorkflowDefinitionChange={setWorkflowDefinition}
              onJumpToWorkflowAction={handleJumpToWorkflowAction}
              onCloseProperties={() => setSelectedComponentId(null)}
              workspaceConnectionId={workspaceConnectionId || undefined}
              workspaceUrl={resolvedWorkspaceUrl}
              normalizedAppResources={appSettingsNormalizedResources}
              isDragActive={activeDragData !== null}
              canvasContextType={propertiesCanvasContextType}
              pageWidth={pageWidth}
              onPageWidthChange={handlePageWidthChange}
            />
          </div>
        )}

        {/* AI Builder chat overlay */}
        <Suspense fallback={null}>
          <AiBuilderChat
            isOpen={showAiChat}
            onClose={() => setShowAiChat(false)}
            appId={appId}
            currentComponents={allComponents}
            currentWorkflows={workflowDefinition.workflows}
            customModulesCode={appDetails.customModulesCode}
            onApplyOperations={handleAiOperations}
          />
        </Suspense>
      </div>
      <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
        {activeDragData ? (
          <div className="pointer-events-none inline-flex items-center gap-1 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="max-w-28 truncate">{activeDragData.label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
