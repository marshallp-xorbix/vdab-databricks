import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import {
  databricksDataConnectorApi,
  type LakebaseAutoscalingBranchOption,
  type LakebaseAutoscalingProjectOption,
} from "../../providers/DatabricksDataConnectorApi";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import {
  buildAutoscalingResourceDatabaseOptions,
  formatAutoscalingBranchLabel,
  formatAutoscalingProjectLabel,
  getAutoscalingProjectPickerLabel,
  getPostgresDatabaseNameForWirePick,
  getWireDatabaseIdForLogicalName,
  parseAutoscalingInstanceName,
  pickWireDatabaseResourceId,
} from "../../utils/lakebaseAutoscaling/autoscalingLabels";
import { normalizeLakebaseAutoscalingSelector } from "../../utils/lakebaseAutoscaling/normalizeLakebaseAutoscalingSelector";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface LakebaseAutoscalingDatabaseResourceSelectorProps {
  databaseName: string;
  databaseDisplayName: string;
  instanceName: string;
  permission: string;
  workspaceConnectionId?: number;
  showFieldLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
  onChange: (next: {
    database_name: string;
    database_display_name: string;
    instance_name: string;
    permission: string;
  }) => void;
}

/**
 * Databricks Apps postgres resources use {@code instance_name} = {@code projectId}/{@code branchUid}
 * and {@code database_name} (see AppSettingsDetailsMapperTests).
 */
function findProjectForSavedInstance(
  projects: LakebaseAutoscalingProjectOption[],
  instanceName: string,
): LakebaseAutoscalingProjectOption | undefined {
  const key = instanceName.trim();
  if (!key) {
    return undefined;
  }
  const { projectId: fromWire } = parseAutoscalingInstanceName(key);
  const lookup = fromWire || key;
  return projects.find(
    (p) =>
      p.projectId === lookup ||
      p.projectId === key ||
      (p.displayName?.trim() ?? "") === key ||
      formatAutoscalingProjectLabel(p) === key,
  );
}

/**
 * Resolves the branch only when {@code databaseName} matches an API endpoint / picker value
 * on that branch — never the default or first branch by client heuristics.
 */
function findBranchForSavedDatabase(
  project: LakebaseAutoscalingProjectOption,
  databaseName: string,
): LakebaseAutoscalingBranchOption | undefined {
  const db = databaseName.trim();
  if (!db) {
    return undefined;
  }
  const branches = project.branches ?? [];
  for (const b of branches) {
    const opts = buildAutoscalingResourceDatabaseOptions(b);
    if (opts.some((o) => o.value === db || o.label === db)) {
      return b;
    }
    if (
      b.endpoints?.some((e) => {
        const wire = pickWireDatabaseResourceId(e);
        return (
          wire === db ||
          (e.endpointId ?? "").trim() === db ||
          (e.appsDatabaseResourceId ?? "").trim() === db ||
          (e.postgresDatabaseName ?? "").trim() === db
        );
      })
    ) {
      return b;
    }
  }
  return undefined;
}

export const LakebaseAutoscalingDatabaseResourceSelector: FC<
  LakebaseAutoscalingDatabaseResourceSelectorProps
> = ({
  databaseName,
  databaseDisplayName,
  instanceName,
  permission,
  workspaceConnectionId,
  showFieldLabel = true,
  onWorkspaceFetchIssue,
  onChange,
}) => {
  const [projects, setProjects] = useState<LakebaseAutoscalingProjectOption[]>(
    [],
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDatabaseName, setSelectedDatabaseName] = useState("");
  const [branchDatabases, setBranchDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseLoadError, setDatabaseLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  const rowIssue = workspaceMissing ?? loadError ?? databaseLoadError;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      if (workspaceMissing) {
        setProjects([]);
        setLoading(false);
        return;
      }
      try {
        const raw = await databricksDataConnectorApi.getLakebaseAutoscalingSelector(
          workspaceConnectionId!,
        );
        setProjects(normalizeLakebaseAutoscalingSelector(raw).projects);
      } catch (err) {
        setProjects([]);
        setLoadError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  useEffect(() => {
    if (!projects.length) {
      return;
    }
    const project = findProjectForSavedInstance(projects, instanceName);
    if (!project) {
      setSelectedProjectId("");
      setSelectedBranchId("");
      setSelectedDatabaseName("");
      return;
    }
    if (!getAutoscalingProjectPickerLabel(project)) {
      setSelectedProjectId("");
      setSelectedBranchId("");
      setSelectedDatabaseName("");
      return;
    }
    setSelectedProjectId(project.projectId);
    const { branchUid } = parseAutoscalingInstanceName(instanceName);
    let branch = findBranchForSavedDatabase(project, databaseName);
    if (!branch && branchUid) {
      branch = project.branches?.find(
        (b) =>
          b.branchId === branchUid ||
          formatAutoscalingBranchLabel(b) === branchUid,
      );
    }
    const branchId = branch?.branchId ?? "";
    setSelectedBranchId(branchId);
    const displayName = databaseDisplayName.trim();
    if (displayName) {
      setSelectedDatabaseName(displayName);
      return;
    }

    const wireId = databaseName.trim();
    const resolvedDisplay = branch
      ? getPostgresDatabaseNameForWirePick(branch, wireId) || wireId
      : wireId;
    setSelectedDatabaseName(resolvedDisplay);
  }, [projects, instanceName, databaseName, databaseDisplayName]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (
        workspaceMissing ||
        !workspaceConnectionId ||
        !selectedProjectId ||
        !selectedBranchId
      ) {
        if (active) {
          setBranchDatabases([]);
          setDatabaseLoadError(null);
          setLoadingDatabases(false);
        }
        return;
      }

      setLoadingDatabases(true);
      setDatabaseLoadError(null);
      try {
        const databases =
          await databricksDataConnectorApi.getLakebaseAutoscalingDatabases(
            workspaceConnectionId,
            selectedProjectId,
            selectedBranchId,
          );
        if (active) {
          setBranchDatabases(databases ?? []);
        }
      } catch (err) {
        if (active) {
          setBranchDatabases([]);
          setDatabaseLoadError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoadingDatabases(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId, workspaceMissing, selectedProjectId, selectedBranchId]);

  const pickerProjects = useMemo(
    () =>
      projects.filter(
        (p) => getAutoscalingProjectPickerLabel(p) !== null,
      ),
    [projects],
  );

  const selectedProject = projects.find((p) => p.projectId === selectedProjectId);
  const branchOptions = selectedProject?.branches ?? [];
  const databaseOptions = useMemo(() => {
    const base = [...branchDatabases]
      .filter((name) => name.trim().length > 0)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        value: name,
        label: name,
      }));
    const db = selectedDatabaseName.trim();
    if (!db || base.some((o) => o.value === db || o.label === db)) {
      return base;
    }
    return [...base, { value: db, label: db }];
  }, [branchDatabases, selectedDatabaseName]);

  const savedProjectMissing =
    Boolean(instanceName.trim()) &&
    !loading &&
    projects.length > 0 &&
    !findProjectForSavedInstance(projects, instanceName);

  const resetResourceSelection = () => {
    onChange({
      database_name: "",
      database_display_name: "",
      instance_name: "",
      permission,
    });
  };

  const pushChange = (
    nextProjectId: string,
    nextBranchId: string,
    nextDatabaseDisplayName: string,
  ) => {
    const project = projects.find((p) => p.projectId === nextProjectId);
    const branch = project?.branches?.find((b) => b.branchId === nextBranchId);
    if (
      !project ||
      !branch ||
      !nextBranchId.trim() ||
      !nextDatabaseDisplayName.trim()
    ) {
      return;
    }
    const branchSegment = formatAutoscalingBranchLabel(branch);
    if (!branchSegment) {
      return;
    }

    const wireId = getWireDatabaseIdForLogicalName(branch, nextDatabaseDisplayName);
    if (!wireId) {
      setDatabaseLoadError(
        `Could not resolve the Databricks database id for '${nextDatabaseDisplayName}'.`,
      );
      return;
    }

    onChange({
      database_name: wireId,
      database_display_name: nextDatabaseDisplayName,
      instance_name: `${project.projectId}/${branchSegment}`,
      permission,
    });
  };

  const labelClass = showFieldLabel ? RESOURCE_FIELD_LABEL_CLASS : "sr-only";

  /** Keeps long project/branch/database labels on one line inside the app-resources grid. */
  const truncateSelectTrigger =
    "h-9 min-w-0 max-w-full text-sm [&>span]:line-clamp-1 [&>span]:min-w-0 [&>span]:block [&>span]:truncate";

  const selectDisabled = loading || Boolean(workspaceMissing);
  const noNamedProjects =
    !loading &&
    !loadError &&
    !workspaceMissing &&
    projects.length > 0 &&
    pickerProjects.length === 0;

  const placeholderTop = workspaceMissing
    ? "Workspace not connected"
    : loading
      ? "Loading Lakebase projects..."
      : loadError
        ? "Could not load Lakebase data"
        : savedProjectMissing
          ? `Saved project not in list: ${instanceName}. Pick again or check API access.`
          : noNamedProjects
            ? "No projects with a display name"
            : "Select project";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-3">
        <div className="min-w-0 space-y-1">
          <Label className={labelClass}>Lakebase project name</Label>
          <Select
            value={
              selectedProjectId &&
              pickerProjects.some((p) => p.projectId === selectedProjectId)
                ? selectedProjectId
                : undefined
            }
            onValueChange={(nextProjectId) => {
              setSelectedProjectId(nextProjectId);
              setSelectedBranchId("");
              setSelectedDatabaseName("");
              resetResourceSelection();
            }}
            disabled={selectDisabled}
          >
            <SelectTrigger className={truncateSelectTrigger}>
              <SelectValue placeholder={placeholderTop} />
            </SelectTrigger>
            <SelectContent className="max-h-[min(24rem,70vh)]">
              {loading ? (
                <SelectItem value={SELECT_DISABLED.loading} disabled>
                  Loading...
                </SelectItem>
              ) : rowIssue ? (
                <SelectItem value={SELECT_DISABLED.error} disabled>
                  {rowIssue}
                </SelectItem>
              ) : projects.length === 0 ? (
                <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                  No Lakebase projects in this workspace
                </SelectItem>
              ) : pickerProjects.length === 0 ? (
                <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                  No projects with a display name (UUID-only projects are hidden)
                </SelectItem>
              ) : (
                pickerProjects.map((project) => (
                  <SelectItem key={project.projectId} value={project.projectId}>
                    {getAutoscalingProjectPickerLabel(project)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1">
          <Label className={labelClass}>Branch UID</Label>
          <Select
            value={selectedBranchId || undefined}
            onValueChange={(nextBranchId) => {
              setSelectedBranchId(nextBranchId);
              setSelectedDatabaseName("");
              resetResourceSelection();
            }}
            disabled={selectDisabled || !selectedProjectId || branchOptions.length === 0}
          >
            <SelectTrigger className={truncateSelectTrigger}>
              <SelectValue placeholder="Select branch UID…" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(24rem,70vh)]">
              {branchOptions.length === 0 ? (
                <SelectItem value="none" disabled>
                  No branches
                </SelectItem>
              ) : (
                branchOptions.map((branch) => (
                  <SelectItem key={branch.branchId} value={branch.branchId}>
                    {formatAutoscalingBranchLabel(branch)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <Label className={labelClass}>Database</Label>
        <Select
          value={selectedDatabaseName || undefined}
          onValueChange={(nextDb) => {
            setSelectedDatabaseName(nextDb);
            setDatabaseLoadError(null);
            pushChange(selectedProjectId, selectedBranchId, nextDb);
          }}
          disabled={
            selectDisabled ||
            !selectedProjectId ||
            !selectedBranchId ||
            loadingDatabases
          }
        >
          <SelectTrigger className={truncateSelectTrigger}>
            <SelectValue
              placeholder={
                !selectedBranchId
                  ? "Select branch UID first..."
                  : loadingDatabases
                    ? "Loading databases..."
                    : "Select database..."
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            {loadingDatabases ? (
              <SelectItem value={SELECT_DISABLED.loading} disabled>
                Loading...
              </SelectItem>
            ) : databaseLoadError ? (
              <SelectItem value={SELECT_DISABLED.error} disabled>
                {databaseLoadError}
              </SelectItem>
            ) : !selectedBranchId ? (
              <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
                Select branch UID first
              </SelectItem>
            ) : databaseOptions.length === 0 ? (
              <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                No databases for this branch
              </SelectItem>
            ) : (
              databaseOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
