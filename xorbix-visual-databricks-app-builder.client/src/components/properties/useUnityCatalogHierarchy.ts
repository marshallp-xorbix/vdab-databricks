import { useEffect, useState } from "react";
import { WORKSPACE_CONNECTION_MISSING_MESSAGE } from "../../constants/databricksAppResourcesUi";
import { databricksDataConnectorApi } from "../../providers/DatabricksDataConnectorApi";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";

interface UseUnityCatalogHierarchyOptions {
  workspaceConnectionId?: number;
  selectedCatalog?: string;
}

interface UseUnityCatalogHierarchyResult {
  catalogs: string[];
  schemas: string[];
  loadingCatalogs: boolean;
  loadingSchemas: boolean;
  catalogError: string | null;
  schemaError: string | null;
}

export function useUnityCatalogHierarchy({
  workspaceConnectionId,
  selectedCatalog,
}: UseUnityCatalogHierarchyOptions): UseUnityCatalogHierarchyResult {
  const [catalogs, setCatalogs] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchCatalogs = async () => {
      if (!workspaceConnectionId || workspaceConnectionId <= 0) {
        setCatalogs([]);
        setSchemas([]);
        setCatalogError(WORKSPACE_CONNECTION_MISSING_MESSAGE);
        return;
      }

      setLoadingCatalogs(true);
      setCatalogError(null);
      try {
        const data = await databricksDataConnectorApi.getUnityCatalogCatalogs(
          workspaceConnectionId,
        );
        if (active) setCatalogs(data || []);
      } catch (err) {
        if (active) {
          setCatalogs([]);
          setSchemas([]);
          setCatalogError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) setLoadingCatalogs(false);
      }
    };

    void fetchCatalogs();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId]);

  useEffect(() => {
    let active = true;

    const fetchSchemas = async () => {
      if (!workspaceConnectionId || workspaceConnectionId <= 0) {
        setSchemas([]);
        return;
      }

      if (!selectedCatalog) {
        setSchemas([]);
        return;
      }

      setLoadingSchemas(true);
      setSchemaError(null);
      try {
        const data = await databricksDataConnectorApi.getUnityCatalogSchemas(
          workspaceConnectionId,
          selectedCatalog,
        );
        if (active) setSchemas(data || []);
      } catch (err) {
        if (active) {
          setSchemas([]);
          setSchemaError(formatApiErrorMessage(err));
        }
      } finally {
        if (active) setLoadingSchemas(false);
      }
    };

    void fetchSchemas();
    return () => {
      active = false;
    };
  }, [workspaceConnectionId, selectedCatalog]);

  return {
    catalogs,
    schemas,
    loadingCatalogs,
    loadingSchemas,
    catalogError,
    schemaError,
  };
}
