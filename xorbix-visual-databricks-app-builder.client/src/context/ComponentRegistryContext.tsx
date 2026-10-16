import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  canvasApi,
  type ComponentRegistryResponse,
} from "../providers/CanvasApi";
import { useLogger } from "../logger/useLogger";
import { normalizeVdabComponentEnums } from "../utils/componentEnumGuards";

interface ComponentRegistryContextType {
  registry: ComponentRegistryResponse | null;
  loading: boolean;
  error: string | null;
}

const ComponentRegistryContext = createContext<
  ComponentRegistryContextType | undefined
>(undefined);

interface ComponentRegistryProviderProps {
  children: ReactNode;
}

export function ComponentRegistryProvider({
  children,
}: ComponentRegistryProviderProps) {
  const logger = useLogger("ComponentRegistryProvider");
  const [registry, setRegistry] = useState<ComponentRegistryResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchRegistry = async () => {
      try {
        setLoading(true);
        const data = await canvasApi.getRegistry();
        if (mounted) {
          setRegistry({
            ...data,
            components: data.components.map(normalizeVdabComponentEnums),
          });
          setError(null);
          logger.UI.log(
            "[ComponentRegistryProvider] Retrieved registry data once"
          );
        }
      } catch (err) {
        if (mounted) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to fetch component registry";
          logger.UI.error(
            "[ComponentRegistryProvider] Error occurred:",
            errorMessage,
            err
          );
          setError(errorMessage);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRegistry();

    return () => {
      mounted = false;
    };
  }, []);

  const value: ComponentRegistryContextType = {
    registry,
    loading,
    error,
  };

  return (
    <ComponentRegistryContext.Provider value={value}>
      {children}
    </ComponentRegistryContext.Provider>
  );
}

export function useComponentRegistry(): ComponentRegistryContextType {
  const context = useContext(ComponentRegistryContext);
  if (context === undefined) {
    throw new Error(
      "useComponentRegistry must be used within a ComponentRegistryProvider"
    );
  }
  return context;
}
