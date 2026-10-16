import { useEffect, useRef, useState } from "react";
import {
  databricksDataConnectorApi,
  type LakebaseAppResourceDatabaseOption,
} from "../../providers/DatabricksDataConnectorApi";
import type { LakebaseSelectorValue } from "./LakebaseTableSelectorFields";
import { useLogger } from "../../logger/useLogger";

interface UseLakebaseInstancesAndDatabaseOptions {
  workspaceConnectionId?: number;
  selectedCatalog?: string;
  selectedSchema: string;
  instanceName?: string;
  currentCatalog?: string;
  currentDatabase?: string;
  currentTable?: string;
  onChange: (next: LakebaseSelectorValue) => void;
}

interface UseLakebaseInstancesAndDatabaseResult {
  instances: string[];
  loadingInstances: boolean;
  instanceError: string | null;
}

export function useLakebaseInstancesAndDatabase({
  workspaceConnectionId,
  selectedSchema,
  instanceName,
  currentCatalog,
  currentDatabase,
  currentTable,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedCatalog: _selectedCatalog,
}: UseLakebaseInstancesAndDatabaseOptions): UseLakebaseInstancesAndDatabaseResult {
  const logger = useLogger("useLakebaseInstancesAndDatabase");
  const [instanceObjects, setInstanceObjects] = useState<LakebaseAppResourceDatabaseOption[]>([]);
  const [instances, setInstances] = useState<string[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;

    const fetchInstances = async () => {
      if (!workspaceConnectionId || workspaceConnectionId <= 0) {
        if (active) {
          setInstances([]);
          setInstanceError("Workspace connection is not set for this app.");
        }
        return;
      }

      if (active) {
        setInstanceError(null);
        setLoadingInstances(true);
      }

      try {
        const data = await databricksDataConnectorApi.getLakebaseAppResourceDatabaseOptions(
          workspaceConnectionId,
        );
        if (active) {
          const valid = (data || []).filter((i) => Boolean(i.instanceName));
          setInstanceObjects(valid);
          setInstances(valid.map((i) => i.instanceName));
        }
      } catch (err) {
        logger.UI.error(
          "[useLakebaseInstancesAndDatabase] Error fetching Lakebase instances:",
          err,
        );
        if (active) {
          setInstanceObjects([]);
          setInstances([]);
          setInstanceError(
            err instanceof Error
              ? err.message
              : "Failed to fetch Lakebase data",
          );
        }
      } finally {
        if (active) setLoadingInstances(false);
      }
    };

    void fetchInstances();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId]);

  useEffect(() => {
    if (!instanceName || instanceObjects.length === 0) return;

    const instance = instanceObjects.find((i) => i.instanceName === instanceName);
    if (!instance?.databaseName) return;

    if (instance.databaseName !== currentDatabase) {
      onChangeRef.current({
        instanceName,
        catalog: currentCatalog,
        schema: selectedSchema || undefined,
        table: currentTable,
        database: instance.databaseName,
      });
    }
  }, [instanceName, instanceObjects, selectedSchema, currentCatalog, currentDatabase, currentTable]);

  return { instances, loadingInstances, instanceError };
}
