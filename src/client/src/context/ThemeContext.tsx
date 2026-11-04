import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "vdab-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

interface IThemeContext {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<IThemeContext | undefined>(undefined);

/**
 * The FOUC init script already resolved the theme onto `<html>`; read it back.
 */
export function readAppliedTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }

  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

/**
 * Applies theme class + color-scheme on the document element.
 */
export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

interface IThemeProviderProps {
  readonly children: ReactNode;
}

/**
 * Client appearance preference (dark default). Separate from SettingsContext.
 * Persists only on explicit setTheme so the default stays changeable.
 */
export function ThemeProvider({ children }: IThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(readAppliedTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    // Sync DOM update so getComputedStyle (e.g. chart theme hooks) reads the new theme.
    applyThemeToDocument(next);
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage access errors
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Access product UI theme preference.
 */
export function useTheme(): IThemeContext {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
