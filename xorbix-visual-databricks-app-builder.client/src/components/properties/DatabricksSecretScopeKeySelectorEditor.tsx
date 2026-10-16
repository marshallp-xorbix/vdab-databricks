import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_DISABLED,
  WORKSPACE_CONNECTION_MISSING_MESSAGE,
} from "../../constants/databricksAppResourcesUi";
import { useReportWorkspacePickerIssue } from "../../hooks/useReportWorkspacePickerIssue";
import { databricksDataConnectorApi } from "../../providers/DatabricksDataConnectorApi";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface DatabricksSecretScopeKeySelectorEditorProps {
  scope: string;
  keyName: string;
  onChange: (next: { scope: string; key: string }) => void;
  workspaceConnectionId?: number;
  showFieldLabels?: boolean;
  onWorkspaceFetchIssue?: (message: string | null) => void;
}

export const DatabricksSecretScopeKeySelectorEditor: FC<
  DatabricksSecretScopeKeySelectorEditorProps
> = ({
  scope,
  keyName,
  onChange,
  workspaceConnectionId,
  showFieldLabels = true,
  onWorkspaceFetchIssue,
}) => {
  const [scopes, setScopes] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);

  const workspaceMissing =
    !workspaceConnectionId || workspaceConnectionId <= 0
      ? WORKSPACE_CONNECTION_MISSING_MESSAGE
      : null;

  useEffect(() => {
    const run = async () => {
      setLoadingScopes(true);
      setScopeError(null);
      if (workspaceMissing) {
        setScopes([]);
        setLoadingScopes(false);
        return;
      }
      try {
        const data = await databricksDataConnectorApi.getSecretScopes(
          workspaceConnectionId!,
        );
        setScopes(data || []);
      } catch (err) {
        setScopes([]);
        setScopeError(formatApiErrorMessage(err));
      } finally {
        setLoadingScopes(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing]);

  useEffect(() => {
    const run = async () => {
      setKeys([]);
      setKeysError(null);
      if (workspaceMissing || !scope.trim()) {
        return;
      }
      setLoadingKeys(true);
      try {
        const data = await databricksDataConnectorApi.getSecretKeys(
          workspaceConnectionId!,
          scope.trim(),
        );
        setKeys(data || []);
      } catch (err) {
        setKeysError(formatApiErrorMessage(err));
      } finally {
        setLoadingKeys(false);
      }
    };
    void run();
  }, [workspaceConnectionId, workspaceMissing, scope]);

  const scopeOptions = useMemo(() => {
    const list = [...scopes];
    const s = scope.trim();
    if (s && !list.includes(s)) {
      list.push(s);
    }
    return list.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [scopes, scope]);

  const keyOptions = useMemo(() => {
    const list = [...keys];
    const k = keyName.trim();
    if (k && !list.includes(k)) {
      list.push(k);
    }
    return list.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [keys, keyName]);

  const rowIssue =
    workspaceMissing ??
    scopeError ??
    (scope.trim() ? keysError : null);
  useReportWorkspacePickerIssue(rowIssue, onWorkspaceFetchIssue);

  const labelCls = showFieldLabels ? RESOURCE_FIELD_LABEL_CLASS : "sr-only";
  const scopeBlocking = workspaceMissing ?? scopeError;
  const scopeSelectValue = scope.trim() || undefined;
  const keySelectValue = keyName.trim() || undefined;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className={labelCls}>Secret scope</Label>
        <Select
          value={scopeSelectValue}
          onValueChange={(s) => onChange({ scope: s, key: "" })}
          disabled={loadingScopes || Boolean(workspaceMissing)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={
                loadingScopes ? "Loading scopes…" : "Select a scope"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {loadingScopes ? (
              <SelectItem value={SELECT_DISABLED.loading} disabled>
                Loading…
              </SelectItem>
            ) : scopeBlocking ? (
              <SelectItem value={SELECT_DISABLED.error} disabled>
                {scopeBlocking}
              </SelectItem>
            ) : scopeOptions.length === 0 ? (
              <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                No scopes found
              </SelectItem>
            ) : (
              scopeOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className={labelCls}>Secret key</Label>
        <Select
          value={keySelectValue}
          onValueChange={(k) => onChange({ scope, key: k })}
          disabled={!scope.trim() || loadingKeys || Boolean(workspaceMissing)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue
              placeholder={
                !scope.trim()
                  ? "Choose a scope first"
                  : loadingKeys
                    ? "Loading keys…"
                    : "Select a key"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {loadingKeys ? (
              <SelectItem value={SELECT_DISABLED.loading} disabled>
                Loading…
              </SelectItem>
            ) : keysError ? (
              <SelectItem value={SELECT_DISABLED.error} disabled>
                {keysError}
              </SelectItem>
            ) : keyOptions.length === 0 && scope.trim() ? (
              <SelectItem value={SELECT_DISABLED.emptyList} disabled>
                No keys in this scope
              </SelectItem>
            ) : (
              keyOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
