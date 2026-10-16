import type { FC } from "react";
import { useState, useEffect } from "react";
import { databricksDataConnectorApi } from "../../providers/DatabricksDataConnectorApi";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { Binding } from "../../types/components/bindings";
import { useUnityCatalogHierarchy } from "./useUnityCatalogHierarchy";
import { useLogger } from "../../logger/useLogger";

interface DatabricksVolumeConfig {
  catalog?: string;
  schema?: string;
  volume?: string;
  filePath?: string;
}

interface DatabricksVolumeSelectorEditorProps {
  binding: Binding;
  onChange: (binding: Binding) => void;
  workspaceConnectionId?: number;
}

/**
 * Databricks Volume Selector Editor
 * Edits a DatabricksVolume binding config
 */
export const DatabricksVolumeSelectorEditor: FC<
  DatabricksVolumeSelectorEditorProps
> = ({ binding, onChange, workspaceConnectionId }) => {
  const logger = useLogger("DatabricksVolumeSelectorEditor");
  const [volumes, setVolumes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = binding.source.resource || {};
  const catalog = config.catalog as string | undefined;
  const schema = config.schema as string | undefined;
  const volume = config.volume as string | undefined;
  const path = config.filePath as string | undefined;

  const {
    catalogs,
    schemas,
    loadingCatalogs,
    loadingSchemas,
    catalogError: hierarchyCatalogError,
    schemaError: hierarchySchemaError,
  } = useUnityCatalogHierarchy({
    workspaceConnectionId,
    selectedCatalog: catalog,
  });

  useEffect(() => {
    const fetchVolumes = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!workspaceConnectionId || workspaceConnectionId <= 0) {
          setError("Workspace connection is not set for this app.");
          setLoading(false);
          return;
        }

        if (!catalog || !schema) {
          setVolumes([]);
          setLoading(false);
          return;
        }

        const volumesData =
          await databricksDataConnectorApi.getUnityCatalogVolumes(
            workspaceConnectionId,
            catalog,
            schema
          );
        setVolumes(volumesData);
      } catch (err) {
        logger.UI.error(
          "[DatabricksVolumeSelectorEditor] Error fetching volumes:",
          err
        );
        setError(
          err instanceof Error ? err.message : "Failed to fetch volumes"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVolumes();
  }, [workspaceConnectionId, catalog, schema]);

  const updateConfig = (updates: Partial<DatabricksVolumeConfig>) => {
    onChange({
      ...binding,
      source: {
        ...binding.source,
        kind: "resource",
        valueType: "file",
        resource: {
          ...config,
          type: "databricksVolume",
          ...updates,
        },
      },
    });
  };

  const handleCatalogChange = (value: string) => {
    updateConfig({
      catalog: value || undefined,
      schema: undefined,
      volume: undefined,
    });
    setVolumes([]);
  };

  const handleSchemaChange = (value: string) => {
    updateConfig({
      catalog,
      schema: value || undefined,
      volume: undefined,
    });
    setVolumes([]);
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({
      catalog,
      schema,
      volume: config.volume,
      filePath: e.target.value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-foreground font-medium mb-1">Catalog</div>
            <Select
              value={catalog || ""}
              onValueChange={handleCatalogChange}
              disabled={loadingCatalogs || !!hierarchyCatalogError}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    loadingCatalogs ? "Loading catalogs..." : "Select a catalog..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {hierarchyCatalogError ? (
                  <SelectItem value="error" disabled>
                    {hierarchyCatalogError}
                  </SelectItem>
                ) : catalogs.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No catalogs found
                  </SelectItem>
                ) : (
                  catalogs.map((catalogName) => (
                    <SelectItem key={catalogName} value={catalogName}>
                      {catalogName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs text-muted-foreground font-medium mb-1">Schema</div>
            <Select
              value={schema || ""}
              onValueChange={handleSchemaChange}
              disabled={!catalog || loadingSchemas || !!hierarchySchemaError}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    !catalog
                      ? "Select a catalog first..."
                      : loadingSchemas
                        ? "Loading schemas..."
                        : "Select a schema..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {hierarchySchemaError ? (
                  <SelectItem value="error" disabled>
                    {hierarchySchemaError}
                  </SelectItem>
                ) : !catalog ? (
                  <SelectItem value="no-catalog" disabled>
                    Select a catalog first
                  </SelectItem>
                ) : schemas.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No schemas found
                  </SelectItem>
                ) : (
                  schemas.map((schemaName) => (
                    <SelectItem key={schemaName} value={schemaName}>
                      {schemaName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">Loading volumes...</div>
        )}

        {(error || hierarchyCatalogError || hierarchySchemaError) && (
          <div className="text-sm text-destructive">{error || hierarchyCatalogError || hierarchySchemaError}</div>
        )}

        {!loading && !error && !hierarchyCatalogError && !hierarchySchemaError && catalog && schema && volumes.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No volumes found in {catalog}.{schema}
          </div>
        )}

        {!loading && !error && !hierarchyCatalogError && !hierarchySchemaError && volumes.length > 0 && (
          <Select
            value={volume || ""}
            onValueChange={(val) =>
              updateConfig({
                catalog,
                schema,
                volume: val || undefined,
      filePath: config.filePath as string | undefined,
              })
            }
            disabled={!catalog || !schema}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue
                placeholder={
                  !catalog || !schema
                    ? "Select catalog and schema first..."
                    : "Select a volume..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {!catalog || !schema ? (
                <SelectItem value="missing-parent" disabled>
                  Select catalog and schema first
                </SelectItem>
              ) : (
                volumes.map((vol) => (
                  <SelectItem key={vol} value={vol}>
                    {vol}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {volume && (
          <div className="text-xs text-success font-medium">
            Selected: /Volumes/{catalog}/{schema}/{volume}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Path (optional)</Label>
        <Input
          type="text"
          value={path}
          onChange={handlePathChange}
          placeholder="subfolder/path"
          className="w-full"
        />
        <div className="text-xs text-muted-foreground">
          Optional subfolder within the volume (e.g., "uploads" or "data/raw")
        </div>
        {volume && path && (
          <div className="text-xs text-success font-medium">
            Full path: /Volumes/{catalog}/{schema}/{volume}/{path}
          </div>
        )}
      </div>
    </div>
  );
};
