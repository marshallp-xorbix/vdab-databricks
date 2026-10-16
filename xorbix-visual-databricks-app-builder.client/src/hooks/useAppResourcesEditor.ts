import { useCallback, useEffect, useMemo, useState } from "react";
import { appActionApi } from "../providers/AppActionApi";
import { ApiError } from "../models/ApiError";
import { formatApiErrorMessage } from "../utils/apiErrorMessage";
import type { NormalizedAppResource } from "../models/DatabricksAppModels";
import type { AppResourceKind } from "../types/appResourceKinds";
import {
  cloneNormalizedResource,
  createEmptyResource,
  findDuplicateNameKeys,
  nextAvailableDefaultResourceKey,
  rowsFromResources,
  type StagedResourceRow,
  validateResourceRow,
} from "../utils/appResourceEditor";

function newClientId(): string {
  return crypto.randomUUID();
}

interface UseAppResourcesEditorParams {
  appId: number | null;
  databricksAppName: string;
  normalizedResources: NormalizedAppResource[];
  serverUpdateTime: string;
  resourcesLoading: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  reloadDatabricksResources: () => Promise<void>;
}

export interface UseAppResourcesEditorResult {
  rows: StagedResourceRow[];
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  conflictMessage: string | null;
  duplicateKeys: Set<string>;
  rowErrorByClientId: Map<string, string | null>;
  canSave: boolean;
  addResource: (kind: AppResourceKind) => void;
  removeRow: (clientId: string) => void;
  updateRowResource: (
    clientId: string,
    updater: (prev: NormalizedAppResource) => NormalizedAppResource,
  ) => void;
  cancel: () => void;
  /** Resolves to true when resources were saved and reloaded successfully. */
  save: () => Promise<boolean>;
  reloadAfterConflict: () => Promise<void>;
}

export function useAppResourcesEditor({
  appId,
  databricksAppName,
  normalizedResources,
  serverUpdateTime,
  resourcesLoading,
  onDirtyChange,
  reloadDatabricksResources,
}: UseAppResourcesEditorParams): UseAppResourcesEditorResult {
  const [rows, setRows] = useState<StagedResourceRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (resourcesLoading) {
      return;
    }
    if (!databricksAppName || !appId) {
      setRows([]);
      return;
    }
    if (!dirty) {
      setRows(rowsFromResources(normalizedResources, newClientId));
    }
  }, [
    normalizedResources,
    serverUpdateTime,
    resourcesLoading,
    dirty,
    databricksAppName,
    appId,
  ]);

  const duplicateKeys = useMemo(() => findDuplicateNameKeys(rows), [rows]);

  const rowErrorByClientId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of rows) {
      map.set(row.clientId, validateResourceRow(row.resource));
    }
    return map;
  }, [rows]);

  const canSave = useMemo(() => {
    if (!dirty || saving || !appId || !databricksAppName) {
      return false;
    }
    if (!serverUpdateTime.trim()) {
      return false;
    }
    if (duplicateKeys.size > 0) {
      return false;
    }
    for (const row of rows) {
      if (validateResourceRow(row.resource) !== null) {
        return false;
      }
    }
    return true;
  }, [
    dirty,
    saving,
    appId,
    databricksAppName,
    serverUpdateTime,
    duplicateKeys,
    rows,
  ]);

  const addResource = useCallback((kind: AppResourceKind) => {
    setRows((prev) => {
      const existingNames = prev.map((r) => r.resource.name);
      const resource = createEmptyResource(kind);
      resource.name = nextAvailableDefaultResourceKey(kind, existingNames);
      return [
        ...prev,
        {
          clientId: newClientId(),
          resource,
        },
      ];
    });
    setDirty(true);
    setSaveError(null);
    setConflictMessage(null);
  }, []);

  const removeRow = useCallback((clientId: string) => {
    setRows((prev) => prev.filter((r) => r.clientId !== clientId));
    setDirty(true);
    setSaveError(null);
    setConflictMessage(null);
  }, []);

  const updateRowResource = useCallback(
    (
      clientId: string,
      updater: (prev: NormalizedAppResource) => NormalizedAppResource,
    ) => {
      setRows((prev) =>
        prev.map((row) =>
          row.clientId === clientId
            ? { ...row, resource: updater(cloneNormalizedResource(row.resource)) }
            : row,
        ),
      );
      setDirty(true);
      setSaveError(null);
      setConflictMessage(null);
    },
    [],
  );

  const cancel = useCallback(() => {
    setRows(rowsFromResources(normalizedResources, newClientId));
    setDirty(false);
    setSaveError(null);
    setConflictMessage(null);
  }, [normalizedResources]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!appId || !canSave) {
      return false;
    }
    setSaving(true);
    setSaveError(null);
    setConflictMessage(null);
    try {
      await appActionApi.updateAppResources(appId, {
        resources: rows.map((r) => cloneNormalizedResource(r.resource)),
        expectedUpdateTime: serverUpdateTime.trim(),
      });
      setDirty(false);
      await reloadDatabricksResources();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const data = error.data as
          | { detail?: string; errors?: string[] }
          | undefined;
        const detail =
          (typeof data?.detail === "string" && data.detail.trim()
            ? data.detail
            : data?.errors?.join(" ")) ||
          "The Databricks app was updated elsewhere.";
        setConflictMessage(detail);
        return false;
      }
      setSaveError(formatApiErrorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    appId,
    canSave,
    rows,
    serverUpdateTime,
    reloadDatabricksResources,
  ]);

  const reloadAfterConflict = useCallback(async () => {
    setConflictMessage(null);
    setDirty(false);
    await reloadDatabricksResources();
  }, [reloadDatabricksResources]);

  return {
    rows,
    dirty,
    saving,
    saveError,
    conflictMessage,
    duplicateKeys,
    rowErrorByClientId,
    canSave,
    addResource,
    removeRow,
    updateRowResource,
    cancel,
    save,
    reloadAfterConflict,
  };
}
