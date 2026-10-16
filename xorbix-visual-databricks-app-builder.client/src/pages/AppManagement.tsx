import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Search } from "lucide-react";
import { databricksApi } from "../providers/DatabricksApi";
import {
  resolveAppManagementStatusRow,
  type AppManagementStatusRow,
} from "../utils/resolveAppManagementStatus";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { appApi } from "../providers/AppApi";
import { userApi } from "../providers/UserApi";
import {
  type AppDto,
  type IImportConnectionOption,
  type IImportOwnerOption,
} from "../models";
import CreateAppWizardDialog from "../components/CreateAppWizardDialog";
import ExportDialog from "../components/portability/ExportDialog";
import ImportAppsDialog from "../components/portability/ImportAppsDialog";
import { useIdentity } from "../context/IdentityContext";
import { isGlobalAdministrator } from "../utils/roles";
import { buildExportFileName } from "../utils/fileDownload";
import { toast } from "../components/ui/use-toast";
import { useLogger } from "../logger/useLogger";

interface App {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  modifiedOn?: Date;
  lastPublishedAt?: string;
  workspaceConnectionId: number;
  databricksAppName?: string;
}

/**
 * Returns a human-friendly relative label for a date.
 * e.g. "Today at 10:30 AM", "Yesterday at 2:15 PM", "Oct 25"
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (dateDay.getTime() === today.getTime()) return `Today at ${timeStr}`;
  if (dateDay.getTime() === yesterday.getTime())
    return `Yesterday at ${timeStr}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Conservative wrap width so line estimate fits typical cards (avoids under-counting lines). */
const APP_CARD_DESCRIPTION_CHARS_PER_LINE = 26;

/**
 * Estimates how many lines a description needs when wrapped (no clamp).
 */
function estimateDescriptionDisplayLines(description: string): number {
  const normalized = description.trim().length > 0 ? description : "—";
  const segments = normalized.split("\n");
  let lines = 0;
  for (const segment of segments) {
    const s = segment.trimEnd();
    if (s.length === 0) {
      lines += 1;
      continue;
    }
    lines += Math.max(
      1,
      Math.ceil(s.length / APP_CARD_DESCRIPTION_CHARS_PER_LINE),
    );
  }
  return Math.max(1, lines);
}

function AppStatusRowView({
  row,
}: Readonly<{ row: AppManagementStatusRow | undefined }>) {
  if (!row || row.kind === "loading") {
    return (
      <>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground animate-pulse shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Checking…</span>
      </>
    );
  }
  if (row.kind === "draft") {
    return (
      <>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
        <span className="text-sm font-medium text-warning-foreground">Draft</span>
      </>
    );
  }
  if (row.kind === "unauthorized") {
    return (
      <>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning shrink-0" />
        <span className="text-sm font-medium text-warning">
          Unauthorized
        </span>
      </>
    );
  }
  if (row.kind === "error") {
    return (
      <>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
        <span className="text-sm font-medium text-destructive">Error</span>
      </>
    );
  }
  return (
    <>
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${row.dotClass} ${
          row.pulse ? "animate-pulse" : ""
        }`}
      />
      <span className={`text-sm font-medium ${row.labelTextClass}`}>
        {row.label}
      </span>
    </>
  );
}

export default function AppManagement() {
  const logger = useLogger("AppManagement");
  const navigate = useNavigate();
  const { user } = useIdentity();
  const isAdmin = isGlobalAdministrator(user);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [appStatusById, setAppStatusById] = useState<
    Record<string, AppManagementStatusRow>
  >({});
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [exportTitle, setExportTitle] = useState("Export Apps");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importConnections, setImportConnections] = useState<
    IImportConnectionOption[]
  >([]);
  const [importOwners, setImportOwners] = useState<IImportOwnerOption[]>([]);

  // Load apps on mount
  useEffect(() => {
    const loadApps = async () => {
      try {
        setLoading(true);
        const appDtos = await appApi.getAppsByTenant();
        const mappedApps: App[] = appDtos.map((dto: AppDto) => ({
          id: dto.id.toString(),
          name: dto.appName,
          description: dto.description || "No description",
          createdAt: new Date(dto.createdOn).toISOString().split("T")[0],
          modifiedOn: dto.modifiedOn ? new Date(dto.modifiedOn) : undefined,
          lastPublishedAt: dto.lastPublishedAt,
          workspaceConnectionId: dto.workspaceConnectionId,
          databricksAppName: dto.databricksAppName,
        }));
        setApps(mappedApps);
      } catch (error) {
        logger.UI.error("Failed to load apps:", error);
      } finally {
        setLoading(false);
      }
    };

    loadApps();
  }, []);

  // Per-app status: Draft / Unauthorized / Error / Databricks compute state
  useEffect(() => {
    if (apps.length === 0) {
      setAppStatusById({});
      return;
    }

    let cancelled = false;

    async function resolveAll() {
      const loading: Record<string, AppManagementStatusRow> = {};
      for (const app of apps) {
        loading[app.id] = { kind: "loading" };
      }
      setAppStatusById(loading);

      try {
        const connections =
          await databricksApi.getWorkspacesByTenantWithStatus();
        const connectionById = new Map(connections.map((c) => [c.pkId, c]));
        const results = await Promise.all(
          apps.map((app) =>
            resolveAppManagementStatusRow(
              {
                id: app.id,
                workspaceConnectionId: app.workspaceConnectionId,
                databricksAppName: app.databricksAppName,
              },
              connectionById,
            ),
          ),
        );
        if (cancelled) {
          return;
        }
        const next: Record<string, AppManagementStatusRow> = {};
        apps.forEach((app, index) => {
          next[app.id] = results[index];
        });
        setAppStatusById(next);
      } catch {
        if (cancelled) {
          return;
        }
        const err: Record<string, AppManagementStatusRow> = {};
        for (const app of apps) {
          err[app.id] = { kind: "error" };
        }
        setAppStatusById(err);
      }
    }

    void resolveAll();
    return () => {
      cancelled = true;
    };
  }, [apps]);

  const handleAppCreated = (createdApp: AppDto) => {
    const newApp: App = {
      id: createdApp.id.toString(),
      name: createdApp.appName,
      description: createdApp.description || "New app created",
      createdAt: new Date(createdApp.createdOn).toISOString().split("T")[0],
      modifiedOn: createdApp.modifiedOn
        ? new Date(createdApp.modifiedOn)
        : undefined,
      lastPublishedAt: createdApp.lastPublishedAt,
      workspaceConnectionId: createdApp.workspaceConnectionId,
      databricksAppName: createdApp.databricksAppName,
    };

    setApps((prev) => [newApp, ...prev]);
    navigate(`/apps/${newApp.id}?name=${encodeURIComponent(newApp.name)}`);
  };

  const handleOpenApp = (app: App) => {
    navigate(`/apps/${app.id}?name=${encodeURIComponent(app.name)}`);
  };

  const handleEditApp = (app: App) => {
    navigate(
      `/apps/${app.id}?name=${encodeURIComponent(app.name)}&settings=true`,
    );
  };

  const handleExportAll = async () => {
    try {
      const bundle = await appApi.exportApps();
      setExportTitle("Export All Apps");
      setExportJson(JSON.stringify(bundle, null, 2));
    } catch (error) {
      logger.UI.error("Failed to export apps:", error);
      toast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleExportApp = async (app: App) => {
    try {
      const bundle = await appApi.exportApp(Number(app.id));
      setExportTitle(`Export "${app.name}"`);
      setExportJson(JSON.stringify(bundle, null, 2));
    } catch (error) {
      logger.UI.error("Failed to export app:", error);
      toast({
        title: "Export failed",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleOpenImport = async () => {
    try {
      const [connections, users] = await Promise.all([
        databricksApi.getWorkspacesByTenant(),
        userApi.getActiveUsersForTenant(),
      ]);
      setImportConnections(
        connections.map((c) => ({
          pkId: c.pkId,
          workspaceUrl: c.workspaceUrl,
          workspaceDisplayName: c.workspaceDisplayName,
        })),
      );
      setImportOwners(
        users.map((u) => ({
          userId: u.userId,
          label: u.fullName?.trim() ? `${u.fullName} (${u.email})` : u.email,
        })),
      );
      setIsImportOpen(true);
    } catch (error) {
      logger.UI.error("Failed to prepare import:", error);
      toast({
        title: "Could not start import",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const reloadApps = async () => {
    try {
      const appDtos = await appApi.getAppsByTenant();
      setApps(
        appDtos.map((dto: AppDto) => ({
          id: dto.id.toString(),
          name: dto.appName,
          description: dto.description || "No description",
          createdAt: new Date(dto.createdOn).toISOString().split("T")[0],
          modifiedOn: dto.modifiedOn ? new Date(dto.modifiedOn) : undefined,
          lastPublishedAt: dto.lastPublishedAt,
          workspaceConnectionId: dto.workspaceConnectionId,
          databricksAppName: dto.databricksAppName,
        })),
      );
    } catch (error) {
      logger.UI.error("Failed to reload apps:", error);
    }
  };

  const filteredApps = searchQuery.trim()
    ? apps.filter((app) =>
        app.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : apps;

  const descriptionLineCount = useMemo(() => {
    if (filteredApps.length === 0) return 1;
    return Math.max(
      1,
      ...filteredApps.map((a) =>
        estimateDescriptionDisplayLines(a.description),
      ),
    );
  }, [filteredApps]);

  const descriptionMinHeightRem = descriptionLineCount * 1.25;

  return (
    <div className="mx-auto max-w-7xl space-y-6 overscroll-none px-8 py-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground shrink-0">
          Apps
        </h1>
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="shrink-0 rounded-lg shadow-md hover:opacity-90"
          >
            Create New App
          </Button>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label="App import and export actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportAll}>
                  Export all apps
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenImport}>
                  Import apps…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Apps Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-muted-foreground">Loading apps...</div>
        </div>
      ) : filteredApps.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {filteredApps.map((app) => {
            const statusRow = appStatusById[app.id];
            const lastEdited = app.modifiedOn
              ? formatRelativeDate(app.modifiedOn)
              : app.createdAt;
            return (
              <div
                key={app.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-[var(--card-shadow)] transition-all hover:border-primary/35 hover:shadow-md"
              >
                <div className="flex flex-1 flex-col">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {app.name}
                  </h3>
                  <p
                    className="mb-4 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground"
                    style={{ minHeight: `${descriptionMinHeightRem}rem` }}
                  >
                    {app.description}
                  </p>
                  <div className="mt-auto">
                    <div className="flex min-h-[1.25rem] items-center gap-2 mb-0.5">
                      <AppStatusRowView row={statusRow} />
                    </div>
                    <p className="text-xs leading-tight text-muted-foreground">
                      Last edited: {lastEdited}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditApp(app)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenApp(app)}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 shadow-md hover:opacity-90"
                    onClick={() => handleOpenApp(app)}
                  >
                    Deploy
                  </Button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          aria-label={`Actions for ${app.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => handleExportApp(app)}>
                          Export this app
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No apps yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Create your first application to get started
          </p>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="px-6 py-2 rounded-lg shadow-md hover:opacity-90"
          >
            Create Your First App
          </Button>
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No apps match your search.</p>
        </div>
      )}

      <CreateAppWizardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleAppCreated}
      />

      {isAdmin && (
        <>
          <ExportDialog
            open={exportJson !== null}
            onOpenChange={(open) => {
              if (!open) setExportJson(null);
            }}
            title={exportTitle}
            description="Identity, ownership, and secrets are excluded from this export."
            json={exportJson ?? ""}
            fileName={buildExportFileName("apps")}
          />
          <ImportAppsDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            connections={importConnections}
            owners={importOwners}
            defaultOwnerId={user?.userId ?? ""}
            onImported={reloadApps}
          />
        </>
      )}
    </div>
  );
}
