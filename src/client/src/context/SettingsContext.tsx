import type { ReactNode, Dispatch, SetStateAction } from "react";
import {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";

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
}

interface ISettingsProviderProps {
  children: ReactNode;
}

const SettingsContext = createContext<ISettingsContext | undefined>(undefined);

export function SettingsProvider({
  children,
}: Readonly<ISettingsProviderProps>) {
  const [settings, setSettings] = useState<ISettings>({
    debugMode: false,
    loggerConfig: {
      logToConsole: false,
      level: "info",
      filterMode: "exclude",
      filterList: [],
    },
  });

  useEffect(() => {
    const isDebugMode = import.meta.env.VITE_DEBUG_MODE === "true";
    const logToConsole = import.meta.env.VITE_LOG_TO_CONSOLE === "true";
    const logLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || "info";
    const filterMode =
      (import.meta.env.VITE_LOG_FILTER_MODE as FilterMode) || "exclude";
    const filterList = (import.meta.env.VITE_LOG_FILTER_LIST as string) || "";

    setSettings({
      debugMode: isDebugMode,
      loggerConfig: {
        logToConsole,
        level: logLevel,
        filterMode,
        filterList: filterList
          ? filterList.split(",").map((entry) => entry.trim())
          : [],
      },
    });
  }, []);

  const contextValue = useMemo<ISettingsContext>(
    () => ({ settings, setSettings }),
    [settings],
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
