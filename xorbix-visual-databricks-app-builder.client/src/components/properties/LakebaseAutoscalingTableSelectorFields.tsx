import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import {
  databricksDataConnectorApi,
  type LakebaseAutoscalingProjectOption,
  type UnityCatalogTable,
} from "../../providers/DatabricksDataConnectorApi";
import {
  getWorkspaceLakebaseBranchOptions,
  listWorkspaceLakebaseAutoscalingSelector,
  resolveWorkspaceLakebaseMetadataSelection,
} from "../../api/lakebaseAutoscalingWorkspaceApi";
import { listWorkspaceLakebaseSchemas, listWorkspaceLakebaseTables } from "../../api/workspaceLakebaseResourcesApi";
import {
  formatAutoscalingBranchLabel,
  getAutoscalingProjectPickerLabel,
  getPostgresDatabaseNameForWirePick,
  getWireDatabaseIdForLogicalName,
} from "../../utils/lakebaseAutoscaling/autoscalingLabels";
import { normalizeLakebaseAutoscalingSelector } from "../../utils/lakebaseAutoscaling/normalizeLakebaseAutoscalingSelector";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import {
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface LakebaseAutoscalingTableSelectorValue {
  projectId?: string;
  branchId?: string;
  endpointId?: string;
  database?: string;
  catalog?: string;
  schema?: string;
  table?: string;
}

const IS_DATABRICKS_RUNTIME = import.meta.env.VITE_VDAB_RUNTIME === "databricks";

interface LakebaseAutoscalingTableSelectorFieldsProps {
  value: LakebaseAutoscalingTableSelectorValue;
  workspaceConnectionId?: number;
  onChange: (next: LakebaseAutoscalingTableSelectorValue) => void;
}

export const LakebaseAutoscalingTableSelectorFields: FC<
  LakebaseAutoscalingTableSelectorFieldsProps
> = ({
  value,
  workspaceConnectionId,
  onChange,
}) => {
  const [projects, setProjects] = useState<LakebaseAutoscalingProjectOption[]>(
    [],
  );
  const [loadingSelector, setLoadingSelector] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseLoadError, setDatabaseLoadError] = useState<string | null>(null);
  const [databaseLoadAttempt, setDatabaseLoadAttempt] = useState(0);

  const [schemas, setSchemas] = useState<string[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [schemaLoadError, setSchemaLoadError] = useState<string | null>(null);
  const [schemaLoadAttempt, setSchemaLoadAttempt] = useState(0);

  const [tables, setTables] = useState<UnityCatalogTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableLoadError, setTableLoadError] = useState<string | null>(null);
  const [tableLoadAttempt, setTableLoadAttempt] = useState(0);

  const workspaceMissing =
    !IS_DATABRICKS_RUNTIME && (!workspaceConnectionId || workspaceConnectionId <= 0)
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  const truncateSelectTrigger =
    "h-9 min-w-0 w-full max-w-full text-sm [&>span]:line-clamp-1 [&>span]:min-w-0 [&>span]:block [&>span]:truncate";

  const loadProjects = useCallback(async () => {
    if (workspaceMissing) {
      setProjects([]);
      setSelectorError(workspaceMissing);
      return;
    }
    setLoadingSelector(true);
    setSelectorError(null);
    try {
      const raw = IS_DATABRICKS_RUNTIME
        ? await listWorkspaceLakebaseAutoscalingSelector()
        : await databricksDataConnectorApi.getLakebaseAutoscalingSelector(workspaceConnectionId!);
      setProjects(normalizeLakebaseAutoscalingSelector(raw).projects);
    } catch (err) {
      console.error(
        "[LakebaseAutoscalingTableSelectorFields] selector load failed",
        err,
      );
      setProjects([]);
      setSelectorError(formatApiErrorMessage(err));
    } finally {
      setLoadingSelector(false);
    }
  }, [workspaceConnectionId, workspaceMissing]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects, loadAttempt]);

  const pickerProjects = useMemo(
    () =>
      projects.filter((p) => getAutoscalingProjectPickerLabel(p) !== null),
    [projects],
  );

  useEffect(() => {
    if (!projects.length || !value.projectId) {
      return;
    }
    const project = projects.find((p) => p.projectId === value.projectId);
    if (project && !getAutoscalingProjectPickerLabel(project)) {
      onChange({
        ...value,
        projectId: undefined,
        branchId: undefined,
        endpointId: undefined,
        database: undefined,
        catalog: undefined,
        schema: undefined,
        table: undefined,
      });
    }
  }, [projects, value, onChange]);

  const selectedProject = projects.find((p) => p.projectId === value.projectId);
  const branchOptions = selectedProject?.branches ?? [];
  const selectedBranch = branchOptions.find((b) => b.branchId === value.branchId);
  const legacyDatabaseId = useMemo(() => {
    const endpointId = (value.endpointId ?? "").trim();
    if (endpointId.toLowerCase().startsWith("db-")) {
      return endpointId;
    }
    const db = (value.database ?? "").trim();
    if (db.toLowerCase().startsWith("db-")) {
      return db;
    }
    return "";
  }, [value.endpointId, value.database]);

  const legacyDatabaseName = useMemo(() => {
    if (!selectedBranch || !legacyDatabaseId) {
      return "";
    }
    return getPostgresDatabaseNameForWirePick(selectedBranch, legacyDatabaseId);
  }, [selectedBranch, legacyDatabaseId]);

  const selectedDatabaseName = useMemo(() => {
    const database = (value.database ?? "").trim();
    if (database && !database.toLowerCase().startsWith("db-")) {
      return database;
    }

    const catalog = (value.catalog ?? "").trim();
    if (catalog && !catalog.toLowerCase().startsWith("db-")) {
      return catalog;
    }

    return legacyDatabaseName.trim();
  }, [legacyDatabaseName, value.catalog, value.database]);

  const selectedDatabaseResourceId = useMemo(() => {
    if (!selectedBranch || !selectedDatabaseName) {
      return "";
    }
    return getWireDatabaseIdForLogicalName(selectedBranch, selectedDatabaseName).trim();
  }, [selectedBranch, selectedDatabaseName]);

  const databasePickOptions = useMemo(
    () =>
      [...databases]
        .filter((name) => name.trim().length > 0)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          value: name,
          label: name,
        })),
    [databases],
  );

  const hasDatabaseSelection = Boolean(selectedDatabaseName);

  /**
   * Normalize saved bindings: replace {@code database} when it mistakenly stored only the db-* id,
   * and fill logical UC catalog name. Do not clear {@code endpointId} for db-* — SaveToTable requires it.
   */
  useEffect(() => {
    const logical = selectedDatabaseName.trim();
    const db = (value.database ?? "").trim();
    const cat = (value.catalog ?? "").trim();

    const updates: Partial<LakebaseAutoscalingTableSelectorValue> = {};
    if (logical && db.toLowerCase().startsWith("db-")) {
      updates.database = logical;
      if (!cat) {
        updates.catalog = logical;
      }
    } else if (logical && !db && !cat) {
      updates.database = logical;
      updates.catalog = logical;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }
    onChange({
      ...value,
      ...updates,
    });
  }, [
    selectedDatabaseName,
    value,
    onChange,
  ]);

  /**
   * SaveToTable / backend require {@code endpointId} (ep-* or db-* wire id). After project data loads
   * or when legacy state had only a logical database name, fill it when missing.
   */
  useEffect(() => {
    if (!selectedBranch) {
      return;
    }
    const logical = selectedDatabaseName.trim();
    if (!logical) {
      return;
    }
    const wireId = getWireDatabaseIdForLogicalName(selectedBranch, logical).trim();
    if (!wireId) {
      return;
    }
    if ((value.endpointId ?? "").trim()) {
      return;
    }
    onChange({
      ...value,
      endpointId: wireId,
    });
  }, [
    onChange,
    selectedBranch,
    selectedDatabaseName,
    value,
  ]);

  const projectSelectValue =
    value.projectId &&
    pickerProjects.some((p) => p.projectId === value.projectId)
      ? value.projectId
      : undefined;

  const noNamedProjects =
    !loadingSelector &&
    !selectorError &&
    !workspaceMissing &&
    projects.length > 0 &&
    pickerProjects.length === 0;

  const resolveDatabaseSelectValue = (): string | undefined => {
    if (!value.branchId) {
      return undefined;
    }
    if (!selectedDatabaseName) {
      return undefined;
    }
    return databasePickOptions.some((option) => option.value === selectedDatabaseName)
      ? selectedDatabaseName
      : undefined;
  };

  const applyDatabasePick = (databaseName: string) => {
    const logical = databaseName.trim();
    const wireId =
      logical && selectedBranch
        ? getWireDatabaseIdForLogicalName(selectedBranch, logical).trim()
        : "";
    onChange({
      ...value,
      database: logical || undefined,
      catalog: logical,
      endpointId: wireId || undefined,
      schema: undefined,
      table: undefined,
    });
  };

  const projectField = (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">Lakebase project name</Label>
      <p className="text-xs text-muted-foreground">
        Choose a Lakebase project first. Other fields unlock in order.
      </p>
      <Select
        value={projectSelectValue}
        onValueChange={(projectId) => {
          onChange({
            ...value,
            projectId,
            branchId: undefined,
            endpointId: undefined,
            database: undefined,
            catalog: undefined,
            schema: undefined,
            table: undefined,
          });
        }}
        disabled={loadingSelector}
      >
        <SelectTrigger className={truncateSelectTrigger}>
          <SelectValue
            placeholder={
              loadingSelector
                ? "Loading projects…"
                : noNamedProjects
                  ? "No projects with a display name"
                  : "Select Lakebase project…"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)] z-[200]">
          {loadingSelector ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : projects.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              {selectorError ?? "No Lakebase projects found"}
            </SelectItem>
          ) : pickerProjects.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No projects with a display name (UUID-only projects are hidden)
            </SelectItem>
          ) : (
            pickerProjects.map((p) => (
              <SelectItem key={p.projectId} value={p.projectId}>
                {getAutoscalingProjectPickerLabel(p)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {selectorError && !loadingSelector && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{selectorError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setLoadAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );

  const branchField = (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">Branch UID</Label>
      <Select
        value={
          value.branchId &&
          branchOptions.some((b) => b.branchId === value.branchId)
            ? value.branchId
            : undefined
        }
        onValueChange={(branchId) => {
          onChange({
            ...value,
            branchId,
            endpointId: undefined,
            database: undefined,
            catalog: undefined,
            schema: undefined,
            table: undefined,
          });
        }}
        disabled={
          loadingSelector ||
          !value.projectId ||
          branchOptions.length === 0
        }
      >
        <SelectTrigger className={truncateSelectTrigger}>
          <SelectValue placeholder="Select branch UID…" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)] z-[200]">
          {branchOptions.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No branches
            </SelectItem>
          ) : (
            branchOptions.map((b) => (
              <SelectItem key={b.branchId} value={b.branchId}>
                {formatAutoscalingBranchLabel(b)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (
        workspaceMissing ||
        (!IS_DATABRICKS_RUNTIME && !workspaceConnectionId) ||
        !value.projectId ||
        !value.branchId
      ) {
        if (active) {
          setDatabases([]);
          setDatabaseLoadError(null);
          setLoadingDatabases(false);
        }
        return;
      }

      setLoadingDatabases(true);
      setDatabaseLoadError(null);
      try {
        const selectedBranch = projects
          .find((project) => project.projectId === value.projectId)
          ?.branches.find((branch) => branch.branchId === value.branchId);
        const options = IS_DATABRICKS_RUNTIME && selectedBranch
          ? await getWorkspaceLakebaseBranchOptions(value.projectId, selectedBranch)
          : null;
        const data = options
          ? options.map((option) => option.postgresDatabaseName ?? "")
          : await databricksDataConnectorApi.getLakebaseAutoscalingDatabases(
              workspaceConnectionId!, value.projectId, value.branchId,
            );
        if (active) {
          setDatabases(data || []);
          if (options && selectedBranch && selectedBranch.endpoints.length !== options.length) {
            setProjects((current) => current.map((project) => project.projectId !== value.projectId
              ? project
              : {
                  ...project,
                  branches: project.branches.map((branch) => branch.branchId === value.branchId
                    ? { ...branch, endpoints: options }
                    : branch),
                }));
          }
        }
      } catch (err) {
        if (active) {
          setDatabases([]);
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
  }, [
    projects,
    workspaceConnectionId,
    workspaceMissing,
    value.projectId,
    value.branchId,
    databaseLoadAttempt,
  ]);

  const databaseField = (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">Database</Label>
      <p className="text-xs text-muted-foreground">
        Lakebase database name from the selected branch.
      </p>
      <Select
        value={resolveDatabaseSelectValue()}
        onValueChange={(pick) => {
          applyDatabasePick(pick);
        }}
        disabled={
          loadingSelector ||
          !value.branchId ||
          loadingDatabases
        }
      >
        <SelectTrigger className={truncateSelectTrigger}>
          <SelectValue
            placeholder={
              !value.branchId
                ? "Select branch UID first…"
                : loadingDatabases
                  ? "Loading databases…"
                  : "Select database…"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)] z-[200]">
          {loadingDatabases ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : databaseLoadError ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {databaseLoadError}
            </SelectItem>
          ) : !value.branchId ? (
            <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
              Select branch first
            </SelectItem>
          ) : databasePickOptions.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No databases for this branch
            </SelectItem>
          ) : (
            databasePickOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {databaseLoadError && !loadingDatabases && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{databaseLoadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDatabaseLoadAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (
        workspaceMissing ||
        !value.projectId ||
        !value.branchId ||
        !selectedDatabaseName
      ) {
        if (active) {
          setSchemas([]);
          setSchemaLoadError(null);
        }
        return;
      }
      setLoadingSchemas(true);
      setSchemaLoadError(null);
      try {
        let data: string[];
        if (IS_DATABRICKS_RUNTIME) {
          const metadataSelection = await resolveWorkspaceLakebaseMetadataSelection(
            value.projectId,
            value.branchId,
            selectedDatabaseResourceId,
          );
          if (!metadataSelection) {
            throw new Error("No readable Lakebase database endpoint is available for this selection.");
          }
          data = (await listWorkspaceLakebaseSchemas({
              projectId: value.projectId,
              branchId: value.branchId,
              endpointId: metadataSelection.endpointId,
              databaseName: metadataSelection.databaseName,
            })).items.map((schema) => schema.name);
        } else {
          data = await databricksDataConnectorApi.getLakebaseAutoscalingSchemas(
              workspaceConnectionId!, value.projectId, value.branchId, legacyDatabaseId, selectedDatabaseName,
            );
        }
        if (active) {
          setSchemas(data || []);
        }
      } catch (err) {
        if (active) {
          setSchemas([]);
          setSchemaLoadError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoadingSchemas(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [
    workspaceConnectionId,
    workspaceMissing,
    value.projectId,
    value.branchId,
    legacyDatabaseId,
    selectedDatabaseResourceId,
    selectedDatabaseName,
    schemaLoadAttempt,
  ]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const schema = (value.schema ?? "").trim();
      if (
        workspaceMissing ||
        !value.projectId ||
        !value.branchId ||
        !selectedDatabaseName ||
        !schema
      ) {
        if (active) {
          setTables([]);
          setTableLoadError(null);
        }
        return;
      }
      setLoadingTables(true);
      setTableLoadError(null);
      try {
        let data: UnityCatalogTable[];
        if (IS_DATABRICKS_RUNTIME) {
          const metadataSelection = await resolveWorkspaceLakebaseMetadataSelection(
            value.projectId,
            value.branchId,
            selectedDatabaseResourceId,
          );
          if (!metadataSelection) {
            throw new Error("No readable Lakebase database endpoint is available for this selection.");
          }
          data = (await listWorkspaceLakebaseTables({
              projectId: value.projectId,
              branchId: value.branchId,
              endpointId: metadataSelection.endpointId,
              databaseName: metadataSelection.databaseName,
            }, schema)).items.map((table) => ({
              catalog: metadataSelection.databaseName,
              schema,
              table: table.name,
              fullName: `${metadataSelection.databaseName}.${schema}.${table.name}`,
            }));
        } else {
          data = await databricksDataConnectorApi.getLakebaseAutoscalingTables(
              workspaceConnectionId!, value.projectId, value.branchId, legacyDatabaseId, selectedDatabaseName, schema,
            );
        }
        if (active) {
          setTables(data || []);
        }
      } catch (err) {
        if (active) {
          setTables([]);
          setTableLoadError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoadingTables(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [
    workspaceConnectionId,
    workspaceMissing,
    value.projectId,
    value.branchId,
    legacyDatabaseId,
    selectedDatabaseResourceId,
    selectedDatabaseName,
    value.schema,
    tableLoadAttempt,
  ]);

  const schemaNamesForSelect = (() => {
    const s = (value.schema ?? "").trim();
    if (s && !schemas.includes(s)) {
      return [...schemas, s].sort((a, b) => a.localeCompare(b));
    }
    return schemas;
  })();

  const schemaField = (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">Schema</Label>
      <Select
        value={
          value.schema && schemaNamesForSelect.includes(value.schema)
            ? value.schema
            : undefined
        }
        onValueChange={(schema) => {
          onChange({
            ...value,
            catalog: selectedDatabaseName || value.catalog,
            schema: schema || undefined,
            table: undefined,
          });
        }}
        disabled={
          Boolean(workspaceMissing) ||
          loadingSchemas ||
          !hasDatabaseSelection
        }
      >
        <SelectTrigger className={truncateSelectTrigger}>
          <SelectValue
            placeholder={
              !selectedDatabaseName
                ? "Select project, branch, and database first…"
                : loadingSchemas
                  ? "Loading schemas…"
                  : "Select schema…"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)] z-[200]">
          {loadingSchemas ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : workspaceMissing ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {workspaceMissing}
            </SelectItem>
          ) : !hasDatabaseSelection ? (
            <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
              Select database first
            </SelectItem>
          ) : schemaLoadError ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {schemaLoadError}
            </SelectItem>
          ) : schemaNamesForSelect.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No Schema for this Database
            </SelectItem>
          ) : (
            schemaNamesForSelect.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {schemaLoadError && !loadingSchemas && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{schemaLoadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSchemaLoadAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );

  const tableNamesForSelect = (() => {
    const t = (value.table ?? "").trim();
    const fromApi = tables.map((row) => row.table);
    if (t && !fromApi.includes(t)) {
      return [...fromApi, t].sort((a, b) => a.localeCompare(b));
    }
    return fromApi;
  })();

  const tableField = (
    <div className="min-w-0 space-y-1">
      <Label className="text-sm">Table</Label>
      <Select
        value={
          value.table && tableNamesForSelect.includes(value.table)
            ? value.table
            : undefined
        }
        onValueChange={(table) => {
          onChange({
            ...value,
            catalog: selectedDatabaseName || value.catalog,
            schema: value.schema,
            table: table || undefined,
          });
        }}
        disabled={
          Boolean(workspaceMissing) ||
          loadingTables ||
          !(value.schema ?? "").trim() ||
          !hasDatabaseSelection
        }
      >
        <SelectTrigger className={truncateSelectTrigger}>
          <SelectValue
            placeholder={
              !selectedDatabaseName
                ? "Select project, branch, and database first…"
                : loadingTables
                  ? "Loading tables…"
                  : "Select table…"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)] z-[200]">
          {loadingTables ? (
            <SelectItem value={SELECT_DISABLED.loading} disabled>
              Loading…
            </SelectItem>
          ) : workspaceMissing ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {workspaceMissing}
            </SelectItem>
          ) : !hasDatabaseSelection ? (
            <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
              Select database first
            </SelectItem>
          ) : tableLoadError ? (
            <SelectItem value={SELECT_DISABLED.error} disabled>
              {tableLoadError}
            </SelectItem>
          ) : !(value.schema ?? "").trim() ? (
            <SelectItem value={SELECT_DISABLED.chooseParentsFirst} disabled>
              Select a schema first
            </SelectItem>
          ) : tableNamesForSelect.length === 0 ? (
            <SelectItem value={SELECT_DISABLED.emptyList} disabled>
              No Tables for this Schema
            </SelectItem>
          ) : (
            tableNamesForSelect.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {tableLoadError && !loadingTables && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{tableLoadError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setTableLoadAttempt((n) => n + 1)}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {projectField}
      {branchField}
      {databaseField}
      {schemaField}
      {tableField}
    </div>
  );
};
