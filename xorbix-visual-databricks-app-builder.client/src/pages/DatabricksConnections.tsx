import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, MoreVertical, Search } from "lucide-react";
import { databricksApi } from "../providers/DatabricksApi";
import { userApi } from "../providers/UserApi";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { DatabricksConnection, DatabricksConnectionStatusDto } from "../models";
import { toast } from "../components/ui/use-toast";
import { showAuthFailureToast } from "../utils/authToast";
import { startDatabricksAuthorization } from "../utils/databricksAuth";
import { getDatabricksRedirectUri } from "../config/api";
import { DATABRICKS_AUTH_STORAGE_KEYS } from "../constants/databricksAuthStorageKeys";
import { cn } from "../lib/utils";
import { useIdentity } from "../context/IdentityContext";
import { isGlobalAdministrator } from "../utils/roles";
import { buildExportFileName } from "../utils/fileDownload";
import ExportDialog from "../components/portability/ExportDialog";
import ImportConnectionsDialog from "../components/portability/ImportConnectionsDialog";
import type { IImportOwnerOption } from "../models";
import { useLogger } from "../logger/useLogger";
import TenantAiModelsSection from "../components/databricks/TenantAiModelsSection";
import { useTenantContext } from "../hooks/useTenantContext";
import { canManageTenantSeats } from "../types/tenantRole";

type ConnectionsTab = "workspaces" | "aiModels";

function DatabricksConnections() {
  const logger = useLogger("DatabricksConnections");
  const navigate = useNavigate();
  const { user } = useIdentity();
  const { currentTenant } = useTenantContext();
  const isAdmin = isGlobalAdministrator(user);
  const canManageAiModels = canManageTenantSeats(currentTenant?.role);
  const [activeTab, setActiveTab] = useState<ConnectionsTab>("workspaces");
  const [workspaces, setWorkspaces] = useState<DatabricksConnectionStatusDto[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] =
    useState<DatabricksConnection>(new DatabricksConnection());
  const [loading, setLoading] = useState(true);
  const [disconnectTarget, setDisconnectTarget] =
    useState<DatabricksConnectionStatusDto | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [exportTitle, setExportTitle] = useState("Export Connections");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importOwners, setImportOwners] = useState<IImportOwnerOption[]>([]);

  // Load all connections with auth status from backend
  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await databricksApi.getWorkspacesByTenantWithStatus();
      setWorkspaces(data);
    } catch (err) {
      logger.handleError(err, "loadConnections");
      toast({
        title: "Failed to load connections",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleAddWorkspace = () => {
    setCurrentWorkspace(
      new DatabricksConnection({
        pkId: 0,
        workspaceUrl: "",
        workspaceDisplayName: "",
        clientId: "",
        clientSecret: "",
      }),
    );
    setIsModalOpen(true);
  };

  const handleEditWorkspace = (workspace: DatabricksConnectionStatusDto) => {
    setCurrentWorkspace(
      new DatabricksConnection({
        pkId: workspace.pkId,
        workspaceUrl: workspace.workspaceUrl,
        workspaceDisplayName: workspace.workspaceDisplayName,
        clientId: workspace.clientId,
        ownerId: user?.userId ?? "",
      }),
    );
    setIsModalOpen(true);
  };

  const handleExportAll = async () => {
    try {
      const bundle = await databricksApi.exportConnections();
      setExportTitle("Export All Connections");
      setExportJson(JSON.stringify(bundle, null, 2));
    } catch (error) {
      logger.UI.error("Failed to export connections:", error);
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

  const handleExportWorkspace = async (
    workspace: DatabricksConnectionStatusDto,
  ) => {
    try {
      const bundle = await databricksApi.exportConnection(workspace.pkId);
      setExportTitle(`Export "${workspace.workspaceDisplayName}"`);
      setExportJson(JSON.stringify(bundle, null, 2));
    } catch (error) {
      logger.UI.error("Failed to export connection:", error);
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
      const users = await userApi.getActiveUsersForTenant();
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

  // Save or update workspace
  const handleSave = async () => {
    if (
      currentWorkspace.workspaceUrl.trim() === "" ||
      currentWorkspace.workspaceDisplayName.trim() === ""
    )
      return;

    const payload = {
      workspaceUrl: currentWorkspace.workspaceUrl.trim(),
      workspaceDisplayName: currentWorkspace.workspaceDisplayName.trim(),
      clientId: currentWorkspace.clientId,
      clientSecret: currentWorkspace.clientSecret,
      accessTokenTtlMinutes: currentWorkspace.accessTokenTtlMinutes,
      refreshTokenLifespanMinutes: currentWorkspace.refreshTokenLifespanMinutes,
    };

    try {
      if (currentWorkspace.pkId > 0) {
        await databricksApi.updateWorkspace(currentWorkspace.pkId, payload);
      } else {
        await databricksApi.createWorkspace(payload);
      }

      setIsModalOpen(false);
      await loadConnections();
    } catch (error) {
      logger.UI.error("Error saving workspace:", error);
      toast({
        title: "Failed to save workspace",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const codeVerifier = localStorage.getItem(
      DATABRICKS_AUTH_STORAGE_KEYS.codeVerifier,
    );
    const workspaceUrl = localStorage.getItem(
      DATABRICKS_AUTH_STORAGE_KEYS.workspaceUrl,
    );
    const workspaceConnectionId = localStorage.getItem(
      DATABRICKS_AUTH_STORAGE_KEYS.workspaceConnectionId,
    );
    const workspaceDisplayName = localStorage.getItem(
      DATABRICKS_AUTH_STORAGE_KEYS.workspaceDisplayName,
    );
    const redirectUri = getDatabricksRedirectUri();

    if (!codeVerifier || !workspaceUrl || !workspaceDisplayName || !redirectUri)
      return;

    const exchange = async () => {
      try {
        if (
          localStorage.getItem(DATABRICKS_AUTH_STORAGE_KEYS.oauthProcessing)
        ) {
          logger.UI.log("OAuth already processing, skipping duplicate call");
          return;
        }
        localStorage.setItem(
          DATABRICKS_AUTH_STORAGE_KEYS.oauthProcessing,
          "true",
        );

        // Exchange the code for tokens
        const tokenData = await databricksApi.exchangeToken({
          workspaceUrl,
          code,
          codeVerifier,
          redirectUri,
        });

        if (tokenData.refresh_token && tokenData.access_token) {
          const userWorkspaces = await databricksApi.getWorkspacesByTenant();

          const parsedConnectionId = workspaceConnectionId
            ? Number.parseInt(workspaceConnectionId, 10)
            : Number.NaN;

          let targetConnectionId = Number.isFinite(parsedConnectionId)
            ? parsedConnectionId
            : 0;
          let refreshTokenLifespanMinutes: number | undefined;

          if (targetConnectionId <= 0) {
            const existingWorkspace = userWorkspaces.find(
              (ws) => ws.workspaceUrl === workspaceUrl,
            );

            if (!existingWorkspace || existingWorkspace.pkId <= 0) {
              throw new Error(
                "Workspace connection not found. Please create the workspace connection first.",
              );
            }

            targetConnectionId = existingWorkspace.pkId;
            refreshTokenLifespanMinutes =
              existingWorkspace.refreshTokenLifespanMinutes;
          } else {
            const existingWorkspace = userWorkspaces.find(
              (ws) => ws.pkId === targetConnectionId,
            );
            refreshTokenLifespanMinutes =
              existingWorkspace?.refreshTokenLifespanMinutes;
          }

          // Calculate refresh token expiration using the configured lifespan (in minutes)
          // If not configured, default to null (no expiration tracking)
          let expiresAt: Date | undefined = undefined;
          if (refreshTokenLifespanMinutes) {
            const expiresInMs = refreshTokenLifespanMinutes * 60 * 1000;
            expiresAt = new Date(Date.now() + expiresInMs);
          }

          await databricksApi.updateRefreshToken({
            workspaceConnectionId: targetConnectionId,
            refreshToken: tokenData.refresh_token,
            expiresAt: expiresAt,
          });

          toast({
            title: "Authorization complete",
            description: "Refresh token saved successfully.",
          });
          await loadConnections();
        }

        localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.codeVerifier);
        localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.workspaceUrl);
        localStorage.removeItem(
          DATABRICKS_AUTH_STORAGE_KEYS.workspaceConnectionId,
        );
        localStorage.removeItem(
          DATABRICKS_AUTH_STORAGE_KEYS.workspaceDisplayName,
        );
        const returnUrl = localStorage.getItem(
          DATABRICKS_AUTH_STORAGE_KEYS.returnUrl,
        );
        if (returnUrl) {
          localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.returnUrl);
        }
        localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.oauthProcessing);
        if (returnUrl) {
          navigate(returnUrl, { replace: true });
        }
      } catch (error) {
        logger.UI.error("Error exchanging token:", error);
        localStorage.removeItem(DATABRICKS_AUTH_STORAGE_KEYS.oauthProcessing);
        const handled = showAuthFailureToast(
          error,
          "Authorization failed",
          "Unknown error",
        );

        if (!handled) {
          toast({
            title: "Authorization failed",
            description:
              error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      }
    };

    exchange();
  }, [loadConnections, navigate]);

  const handleAuthorize = async (workspace: DatabricksConnectionStatusDto) => {
    try {
      await startDatabricksAuthorization(
        new DatabricksConnection({
          pkId: workspace.pkId,
          workspaceUrl: workspace.workspaceUrl,
          workspaceDisplayName: workspace.workspaceDisplayName,
          clientId: workspace.clientId,
          ownerId: user?.userId ?? "",
        }),
      );
    } catch (error) {
      logger.UI.error("Error starting authorization:", error);
      const handled = showAuthFailureToast(
        error,
        "Authorization failed",
        "Unknown error",
      );

      if (!handled) {
        toast({
          title: "Authorization failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;

    try {
      await databricksApi.disconnectWorkspace(disconnectTarget.pkId);
      toast({
        title: "Workspace disconnected",
        description: `Disconnected from ${disconnectTarget.workspaceDisplayName}.`,
      });
      setDisconnectTarget(null);
      await loadConnections();
    } catch (error) {
      logger.UI.error("Error disconnecting workspace:", error);
      toast({
        title: "Disconnect failed",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const filteredWorkspaces = searchQuery.trim()
    ? workspaces.filter((ws) =>
        ws.workspaceDisplayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : workspaces;

  return (
    <div className="mx-auto max-w-6xl space-y-6 overscroll-none px-8 py-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Databricks Connections
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHelpOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("workspaces")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
            activeTab === "workspaces"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Workspaces
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("aiModels")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
            activeTab === "aiModels"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          AI Models
        </button>
      </div>

      {activeTab === "aiModels" ? (
        <TenantAiModelsSection
          workspaces={workspaces}
          workspacesLoading={loading}
          canManage={canManageAiModels}
        />
      ) : (
        <>
      {/* Workspace toolbar */}
      <div className="flex items-center justify-end gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleAddWorkspace}
            className="shrink-0 rounded-lg shadow-md hover:opacity-90"
          >
            + Add Workspace
          </Button>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label="Connection import and export actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleExportAll}>
                  Export all connections
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenImport}>
                  Import connections…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-border border-t-primary" />
        </div>
      ) : filteredWorkspaces.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5">
          {filteredWorkspaces.map((workspace) => {
            const expiresAt = workspace.tokenExpiresAt
              ? new Date(workspace.tokenExpiresAt)
              : null;
            return (
              <div
                key={workspace.pkId}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/35 hover:shadow-md"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {workspace.workspaceDisplayName}
                  </h3>
                  <p className="text-sm text-muted-foreground break-all mb-4">
                    {workspace.workspaceUrl}
                  </p>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${workspace.isAuthorized ? "bg-success" : "bg-destructive"}`}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        workspace.isAuthorized
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {workspace.isAuthorized ? "Authorized" : "Not Authorized"}
                    </span>
                  </div>
                  {expiresAt && workspace.isAuthorized && (
                    <p className="text-xs text-muted-foreground">
                      Token expires:{" "}
                      {expiresAt.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditWorkspace(workspace)}
                  >
                    Edit
                  </Button>
                  {workspace.isAuthorized && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-destructive/40 text-destructive hover:bg-destructive-subtle"
                      onClick={() => setDisconnectTarget(workspace)}
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1 shadow-md hover:opacity-90"
                    onClick={() => handleAuthorize(workspace)}
                  >
                    {workspace.isAuthorized ? "Re-authorize" : "Authorize"}
                  </Button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          aria-label={`Actions for ${workspace.workspaceDisplayName}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={() => handleExportWorkspace(workspace)}
                        >
                          Export this connection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? "No workspaces match your search."
              : "No workspaces added yet."}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card p-6 rounded-xl shadow-xl max-w-md w-full border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              {currentWorkspace.pkId ? "Edit Workspace" : "Add Workspace"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              id="workspaceDisplayName"
              type="text"
              placeholder="Workspace Display Name"
              value={currentWorkspace.workspaceDisplayName}
              onChange={(e) =>
                setCurrentWorkspace({
                  ...currentWorkspace,
                  workspaceDisplayName: e.target.value,
                })
              }
            />
            <Input
              id="workspaceUrl"
              type="text"
              placeholder="Workspace URL"
              value={currentWorkspace.workspaceUrl}
              onChange={(e) =>
                setCurrentWorkspace({
                  ...currentWorkspace,
                  workspaceUrl: e.target.value,
                })
              }
            />
            <Input
              id="clientId"
              type="text"
              placeholder="Client ID"
              value={currentWorkspace.clientId}
              onChange={(e) =>
                setCurrentWorkspace({
                  ...currentWorkspace,
                  clientId: e.target.value,
                })
              }
            />
            <Input
              id="clientSecret"
              type="password"
              placeholder="Client Secret"
              value={currentWorkspace.clientSecret}
              onChange={(e) =>
                setCurrentWorkspace({
                  ...currentWorkspace,
                  clientSecret: e.target.value,
                })
              }
            />
            <Input
              id="accessTokenTtlMinutes"
              type="number"
              placeholder="Access Token TTL (minutes)"
              value={currentWorkspace.accessTokenTtlMinutes ?? ""}
              onChange={(e) => {
                const value = e.target.value
                  ? parseInt(e.target.value, 10)
                  : undefined;
                setCurrentWorkspace({
                  ...currentWorkspace,
                  accessTokenTtlMinutes: value,
                });
              }}
            />
            <Input
              id="refreshTokenLifespanMinutes"
              type="number"
              placeholder="Refresh Token Lifespan (minutes)"
              value={currentWorkspace.refreshTokenLifespanMinutes ?? ""}
              min={currentWorkspace.accessTokenTtlMinutes ?? 0}
              max={129600}
              onChange={(e) => {
                const value = e.target.value
                  ? parseInt(e.target.value, 10)
                  : undefined;
                setCurrentWorkspace({
                  ...currentWorkspace,
                  refreshTokenLifespanMinutes: value,
                });
              }}
            />
          </div>

          <DialogFooter className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="rounded-lg shadow-md hover:opacity-90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}

      {/* Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="bg-card p-6 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto border border-border">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold text-foreground">
              How to Set Up a Databricks App Connection
            </DialogTitle>
            <DialogDescription>
              <ol className="list-decimal list-inside space-y-2 text-foreground text-sm leading-relaxed">
                <li>
                  <strong>Open Your Databricks Workspace</strong>
                  <br />
                  Go to your Databricks workspace. Click your workspace name,
                  then select <em>"Manage Account."</em>
                </li>
                <li>
                  <strong>Go to Settings</strong>
                  <br />
                  On the left sidebar, click <em>Settings</em>, then the{" "}
                  <em>"App Connections"</em> tab.
                </li>
                <li>
                  <strong>Add a New Connection</strong>
                  <br />
                  Click <em>"Add Connection"</em> and enter a name. Paste the
                  redirect URLs.
                </li>
                <li>
                  <strong>Select API Access</strong>
                  <br />
                  Click <em>"All APIs"</em> and then <em>"Add"</em>.
                </li>
                <li>
                  <strong>Save and Copy Credentials</strong>
                  <br />
                  Copy your Client ID and Client Secret. Note the Access Token
                  TTL and Refresh Token Lifespan configured in your app
                  connection settings.
                </li>
                <li>
                  <strong>Enter Credentials in the Software</strong>
                  <br />
                  Paste them in the software along with the token lifespan
                  values, then click <em>Save</em>.
                </li>
              </ol>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex justify-end">
            <Button variant="ghost" onClick={() => setIsHelpOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <DialogContent className="bg-card p-6 rounded-xl shadow-xl max-w-sm w-full border border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Disconnect Workspace
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect from{" "}
              <strong>{disconnectTarget?.workspaceDisplayName}</strong>? Your
              refresh token will be revoked and you will need to re-authorize.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            fileName={buildExportFileName("connections")}
          />
          <ImportConnectionsDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            owners={importOwners}
            defaultOwnerId={user?.userId ?? ""}
            onImported={loadConnections}
          />
        </>
      )}
    </div>
  );
}

export default DatabricksConnections;
