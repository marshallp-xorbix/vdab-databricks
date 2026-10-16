import { useMemo, useState, useEffect, useCallback } from "react";

import { useDatabricksAppNames } from "../../../hooks/useDatabricksAppNames";
import type { AppDetails } from "../../../hooks/useAppPersistence";
import type { AppThemeColorKey } from "./themeDefaults";
import AppDetailsTab from "./AppDetailsTab";
import AppThemeTab from "./AppThemeTab";
import AppResourcesTab from "./AppResourcesTab";
import AppPermissionsTab from "./AppPermissionsTab";
import type { DatabricksConnection } from "../../../models";
import type {
  AppSettingsWarning,
  NormalizedAppResource,
} from "../../../models/DatabricksAppModels";
import type { IAppDto } from "../../../models/AppDto";
import type { IAppStatusResponse } from "../../../models/AppStatusResponse";
import { appApi } from "../../../providers/AppApi";
import { appActionApi } from "../../../providers/AppActionApi";
import { Button } from "../../ui/button";
import { getComputeStatusPresentation } from "../builderHeaderComputeStatus";
import { ComputeStatusPill } from "../computeStatusDisplay";
import SettingsCard from "./SettingsCard";
import { BACKGROUND_URL } from "../../../constants/authBranding";
import { useTheme } from "../../../context/ThemeContext";
import { cn } from "../../../lib/utils";

interface AppSettingsTabProps {
  appDetails: AppDetails;
  onAppDetailsChange: (details: AppDetails) => void;
  appTheme: Record<string, string>;
  onAppThemeChange: (theme: Record<string, string>) => void;
  appId: number | null;
  /** Shared Databricks workspace connections from AppBuilder. */
  workspaceConnections: DatabricksConnection[];
  /** Shared normalized app resources from AppBuilder. */
  normalizedResources: NormalizedAppResource[];
  /** Shared appSettings warnings from AppBuilder. */
  appSettingsWarnings: AppSettingsWarning[];
  /** Shared compute size from AppBuilder. */
  appSettingsComputeSize: string;
  /** Shared Databricks app update_time concurrency token from AppBuilder. */
  databricksAppUpdateTime: string;
  /** Whether shared Databricks app details are loading. */
  resourcesLoading: boolean;
  /** Shared resources fetch error from AppBuilder. */
  resourcesError: string | null;
  /** Reloads Databricks app resources in the shared AppBuilder state. */
  reloadDatabricksResources: () => Promise<void>;
  /** Fires when staged resource edits are dirty (for navigation guard). */
  onAppSettingsResourcesDirtyChange?: (dirty: boolean) => void;
  onSave?: () => Promise<void>;
  onDiscard?: () => Promise<void>;
}

function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AppSettingsTab({
  appDetails,
  onAppDetailsChange,
  appTheme,
  onAppThemeChange,
  appId,
  workspaceConnections,
  normalizedResources,
  appSettingsWarnings,
  appSettingsComputeSize,
  databricksAppUpdateTime,
  resourcesLoading,
  resourcesError,
  reloadDatabricksResources,
  onAppSettingsResourcesDirtyChange,
  onSave,
  onDiscard,
}: Readonly<AppSettingsTabProps>) {
  const { theme } = useTheme();
  const useSiteBackground = theme === "light";
  const [activeTab, setActiveTab] = useState<
    "details" | "theme" | "resources" | "permissions"
  >("details");

  const [appMeta, setAppMeta] = useState<IAppDto | null>(null);
  const [appStatus, setAppStatus] = useState<IAppStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const workspaceConnectionId = useMemo(() => {
    const parsed = parseInt(appDetails.workspaceConnectionId, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [appDetails.workspaceConnectionId]);

  const {
    appNames: databricksAppNames,
    loadState: databricksAppNamesLoadState,
    errorMessage: databricksAppNamesError,
  } = useDatabricksAppNames(appId, workspaceConnectionId);

  const databricksAppNameSaveAllowed = useMemo(() => {
    if (!workspaceConnectionId || !appId) {
      return true;
    }
    if (
      databricksAppNamesLoadState === "idle" ||
      databricksAppNamesLoadState === "loading"
    ) {
      return false;
    }
    if (databricksAppNamesLoadState === "error") {
      return false;
    }
    if (databricksAppNames.length === 0) {
      return false;
    }
    const trimmed = appDetails.databricksAppName.trim();
    return trimmed.length > 0 && databricksAppNames.includes(trimmed);
  }, [
    appDetails.databricksAppName,
    appId,
    databricksAppNames,
    databricksAppNamesLoadState,
    workspaceConnectionId,
  ]);

  const loadMeta = useCallback(async () => {
    if (!appId) return;
    try {
      const dto = await appApi.getAppById(appId);
      setAppMeta(dto);
    } catch {
      // non-critical; sidebar will show dashes
    }
  }, [appId]);

  const loadStatus = useCallback(async () => {
    if (!appId) {
      setAppStatus(null);
      return;
    }
    setStatusLoading(true);
    try {
      const status = await appActionApi.getAppStatus(appId);
      setAppStatus(status);
    } catch {
      setAppStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [appId]);

  const metadataComputePresentation = useMemo(
    () =>
      getComputeStatusPresentation({
        appId,
        isComputeUnavailable: false,
        isAwaitingInitialStatus:
          Boolean(appId) && appStatus === null && statusLoading,
        effectiveState: (appStatus?.state ?? "").trim().toUpperCase(),
      }),
    [appId, appStatus, statusLoading],
  );

  useEffect(() => {
    void loadMeta();
    void loadStatus();
  }, [loadMeta, loadStatus]);

  const updateDetail = <K extends keyof AppDetails>(
    field: K,
    value: AppDetails[K],
  ) => {
    onAppDetailsChange({ ...appDetails, [field]: value });
  };

  const updateThemeColor = (key: AppThemeColorKey, value: string) => {
    onAppThemeChange({ ...appTheme, [key]: value });
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
      await loadMeta();
      await loadStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!onDiscard) return;
    setIsDiscarding(true);
    try {
      await onDiscard();
      await loadMeta();
      await loadStatus();
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden overscroll-none",
        useSiteBackground
          ? "bg-cover bg-center bg-no-repeat"
          : "bg-background",
      )}
      style={
        useSiteBackground
          ? {
              backgroundImage: `url("${BACKGROUND_URL}")`,
              backgroundAttachment: "fixed",
            }
          : undefined
      }
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* TOP FROZEN AREA */}
        <div className="flex-shrink-0 border-b border-[var(--builder-chrome-border)] bg-card/90 px-4 backdrop-blur-sm sm:px-5 lg:px-6">
          <div className="flex w-full items-end gap-6 lg:gap-8">
            <h1 className="whitespace-nowrap py-3 text-lg font-semibold text-foreground">
              App Settings
            </h1>
            <div className="flex">
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "details"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("details")}
              >
                App Details
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "theme"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("theme")}
              >
                App Theme
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "resources"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("resources")}
              >
                Resources
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "permissions"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("permissions")}
              >
                Permissions
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLING CONTENT — full width minus modest padding */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none px-4 pb-4 scrollbar-thin scrollbar-thumb-slate-200/80 sm:px-5 lg:px-6">
          <div className="flex w-full min-w-0 flex-1 gap-4 pt-2 lg:gap-6">
            {/* Main tab content */}
            <div className="flex-1 min-w-0 space-y-6">
              {activeTab === "details" && (
                <AppDetailsTab
                  appId={appId}
                  appDetails={appDetails}
                  workspaceConnections={workspaceConnections}
                  onDetailChange={updateDetail}
                  databricksAppNames={databricksAppNames}
                  databricksAppNamesLoadState={databricksAppNamesLoadState}
                  databricksAppNamesError={databricksAppNamesError}
                />
              )}

              {activeTab === "theme" && (
                <AppThemeTab
                  appTheme={appTheme}
                  onThemeColorChange={updateThemeColor}
                />
              )}

              {activeTab === "resources" && (
                <AppResourcesTab
                  normalizedResources={normalizedResources}
                  appSettingsWarnings={appSettingsWarnings}
                  resourcesLoading={resourcesLoading}
                  resourcesError={resourcesError}
                  appSettingsComputeSize={appSettingsComputeSize}
                  appId={appId}
                  databricksAppName={appDetails.databricksAppName}
                  workspaceConnectionId={workspaceConnectionId}
                  serverUpdateTime={databricksAppUpdateTime}
                  reloadDatabricksResources={reloadDatabricksResources}
                  onDirtyChange={onAppSettingsResourcesDirtyChange}
                />
              )}

              {activeTab === "permissions" && <AppPermissionsTab />}
            </div>

            {/* Metadata sidebar */}
            <div className="w-56 flex-shrink-0 space-y-4 sm:w-60 lg:w-64">
              <SettingsCard title="Metadata" padding="sm" as="div">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {formatDate(appMeta?.createdOn)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Last Modified</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {formatDate(appMeta?.modifiedOn)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Owner</dt>
                    <dd className="mt-0.5 font-medium text-foreground truncate">
                      {appMeta?.ownerEmail ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-xs text-muted-foreground">Status</dt>
                    <dd>
                      <ComputeStatusPill
                        presentation={metadataComputePresentation}
                        className="mt-0.5 w-fit"
                      />
                    </dd>
                  </div>
                </dl>
              </SettingsCard>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR — translucent so background remains visible */}
      <div className="relative z-10 mt-auto flex-shrink-0 border-t border-white/40 bg-card/70 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md sm:px-5 lg:px-6">
        <div className="flex w-full items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            disabled
            className="text-destructive hover:text-destructive hover:bg-destructive-subtle disabled:opacity-40"
          >
            Archive Application
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDiscard()}
              disabled={!onDiscard || isDiscarding}
            >
              {isDiscarding ? "Discarding..." : "Discard Changes"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!onSave || isSaving || !databricksAppNameSaveAllowed}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
