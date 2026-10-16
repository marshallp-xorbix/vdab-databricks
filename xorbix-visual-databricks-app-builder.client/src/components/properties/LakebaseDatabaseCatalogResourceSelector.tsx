import type { FC } from "react";
import { useEffect, useState } from "react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import {
  databricksDataConnectorApi,
  type LakebaseAppResourceDatabaseOption,
} from "../../providers/DatabricksDataConnectorApi";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";

interface LakebaseDatabaseCatalogResourceSelectorProps {
  databaseName: string;
  instanceName: string;
  permission: string;
  workspaceConnectionId?: number;
  showCatalogLabel?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
  onChange: (next: {
    database_name: string;
    instance_name: string;
    permission: string;
  }) => void;
}

function optionLabel(opt: LakebaseAppResourceDatabaseOption): string {
  const inst = opt.instanceName?.trim() ?? "";
  const db = opt.databaseName?.trim() ?? "";
  if (!db || db === inst) {
    return inst || db || "—";
  }
  return `${inst} (${db})`;
}

/**
 * Lakebase database instance (Compute → Database instances) for Apps database resources.
 */
export const LakebaseDatabaseCatalogResourceSelector: FC<
  LakebaseDatabaseCatalogResourceSelectorProps
> = ({
  databaseName,
  instanceName,
  permission,
  workspaceConnectionId,
  showCatalogLabel = true,
  onWorkspaceFetchIssue,
  onChange,
}) => {
  const [options, setOptions] = useState<LakebaseAppResourceDatabaseOption[]>(
    [],
  );
  const [selectedInstance, setSelectedInstance] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  const rowIssue = workspaceMissing ?? loadError;
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      if (workspaceMissing) {
        setOptions([]);
        setLoading(false);
        return;
      }
      try {
        const data =
          await databricksDataConnectorApi.getLakebaseAppResourceDatabaseOptions(
            workspaceConnectionId!,
          );
        setOptions(data || []);
      } catch (err) {
        setOptions([]);
        setLoadError(formatApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  useEffect(() => {
    const inst = instanceName.trim();
    if (!inst) {
      setSelectedInstance("");
      return;
    }
    setSelectedInstance(inst);
  }, [instanceName, databaseName]);

  const applyInstance = (instanceKey: string) => {
    setSelectedInstance(instanceKey);
    if (workspaceMissing || !instanceKey.trim()) {
      return;
    }
    const opt = options.find(
      (o) => o.instanceName?.trim() === instanceKey.trim(),
    );
    if (!opt) {
      return;
    }
    onChange({
      database_name: opt.databaseName?.trim() ?? "",
      instance_name: opt.instanceName?.trim() ?? "",
      permission,
    });
  };

  const selectBlocked = loading || Boolean(workspaceMissing);
  const blockingMessage = workspaceMissing ?? loadError;

  const savedNotInList =
    Boolean(instanceName.trim()) &&
    !loading &&
    options.length > 0 &&
    !options.some((o) => o.instanceName?.trim() === instanceName.trim());

  const placeholderText = workspaceMissing
    ? "Workspace not connected"
    : loading
      ? "Loading Lakebase databases…"
      : loadError
        ? "Could not load Lakebase databases"
        : savedNotInList
          ? `Saved instance not in list: ${instanceName}. Pick again or check API access.`
          : databaseName.trim() && !selectedInstance
            ? `Saved: ${databaseName}. Pick an instance to change.`
            : "Select a Lakebase database instance";

  const catalogLabelClass = showCatalogLabel
    ? RESOURCE_FIELD_LABEL_CLASS
    : "sr-only";

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className={catalogLabelClass}>Lakebase database</Label>
        <Select
          value={selectedInstance || undefined}
          onValueChange={(v) => applyInstance(v)}
          disabled={selectBlocked}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={placeholderText} />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            {loading ? (
              <SelectItem value={SELECT_DISABLED.loading} disabled>
                Loading…
              </SelectItem>
            ) : blockingMessage ? (
              <SelectItem value={SELECT_DISABLED.error} disabled>
                {blockingMessage}
              </SelectItem>
            ) : options.length === 0 ? (
              <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                No Lakebase database instances in this workspace
              </SelectItem>
            ) : (
              options.map((opt) => {
                const key = opt.instanceName?.trim() ?? "";
                return (
                  <SelectItem key={key} value={key}>
                    {optionLabel(opt)}
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>
      {(databaseName || instanceName) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className={RESOURCE_FIELD_LABEL_CLASS}>Database name</Label>
            <Input className="h-9 text-sm" value={databaseName} readOnly />
          </div>
          <div className="space-y-1">
            <Label className={RESOURCE_FIELD_LABEL_CLASS}>Instance name</Label>
            <Input
              className="h-9 text-sm"
              value={instanceName}
              readOnly
              placeholder="—"
            />
          </div>
        </div>
      )}
    </div>
  );
};
