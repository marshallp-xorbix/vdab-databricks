import type { ReactNode, Dispatch, SetStateAction } from "react";
import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import FeatureManagement from "../models/FeatureManagement";
import { useFeatureGatesQuery } from "../hooks/useFeatureGatesQuery";

export type LogLevel = "info" | "warn" | "error";
export type FilterMode = "include" | "exclude";

export interface ILoggerConfig {
  logToConsole: boolean;
  level: LogLevel;
  filterMode: FilterMode;
  filterList: string[];
}

export interface ISettings {
  debugMode: boolean;
  loggerConfig: ILoggerConfig;
}

export interface ISettingsContext {
  settings: ISettings;
  setSettings: Dispatch<SetStateAction<ISettings>>;
  uiUpdateDateVersion: string;
  featureGates: FeatureManagement;
  refreshFeatureGates: () => Promise<FeatureManagement>;
}

type SettingsProviderProps = {
  children: ReactNode;
};

const SettingsContext = createContext<ISettingsContext | undefined>(undefined);

export function SettingsProvider({
  children,
}: Readonly<SettingsProviderProps>) {
  // Set the initial state of the settings in environment variables
  const [settings, setSettings] = useState<ISettings>({
    debugMode: false,
    loggerConfig: {
      logToConsole: false,
      level: "info",
      filterMode: "exclude",
      filterList: [],
    },
  });

  const [uiUpdateDateVersion] = useState("20250101");
  const [featureGates, setFeatureGates] = useState<FeatureManagement>(
    () => new FeatureManagement(),
  );

  const { fetchFeatureGates } = useFeatureGatesQuery();

  const refreshFeatureGates = useCallback(async () => {
    const gates = await fetchFeatureGates();
    setFeatureGates(gates);
    return gates;
  }, [fetchFeatureGates]);

  useEffect(() => {
    const isDebugMode = import.meta.env.VITE_DEBUG_MODE === "true";
    const logToConsole = import.meta.env.VITE_LOG_TO_CONSOLE === "true";
    const logLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || "info";
    const filterMode =
      (import.meta.env.VITE_LOG_FILTER_MODE as FilterMode) || "exclude";
    const filterListStr =
      (import.meta.env.VITE_LOG_FILTER_LIST as string) || "";

    setSettings({
      debugMode: isDebugMode,
      loggerConfig: {
        logToConsole,
        level: logLevel,
        filterMode,
        filterList: filterListStr
          ? filterListStr.split(",").map((s) => s.trim())
          : [],
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchFeatureGates()
      .then((gates) => {
        if (!cancelled) setFeatureGates(gates);
      })
      .catch((err) => {
        console.warn("Failed to load feature gates", err);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFeatureGates]);

  const contextValue = useMemo<ISettingsContext>(
    () => ({
      settings,
      setSettings,
      uiUpdateDateVersion,
      featureGates,
      refreshFeatureGates,
    }),
    [settings, uiUpdateDateVersion, featureGates, refreshFeatureGates],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): ISettingsContext {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
