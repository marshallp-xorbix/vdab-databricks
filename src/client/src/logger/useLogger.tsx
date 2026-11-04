import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  type ISettings,
  type LogLevel,
  useSettings,
} from "../context/SettingsContext";
import { TraceLogStore } from "./LoggerStore";
import { parseError } from "../lib/utils";
import { CommonError } from "../models";

// ─── Public Interfaces ───────────────────────────────────────────

/**
 * UI logger channel (local trace + helpers)
 */
export interface UILoggerChannel {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  get: () => string[];
  clear: () => void;
}

/**
 * Shape of the application logger returned by useLogger().
 * Extend if more channels or helpers exist.
 */
export interface AppLogger {
  /** UI-focused local trace log and optional console output. */
  UI: UILoggerChannel;

  /**
   * Generic structured error handler used across the codebase.
   * @param error - The caught error/exception.
   * @param contextMessage - High-level message describing the context.
   * @param options - Extra handling flags.
   */
  handleError: (
    error: unknown,
    contextMessage?: string,
    options?: {
      /** Whether to rethrow after handling. */
      rethrow?: boolean;
      /** Optional severity classification. */
      severity?: "info" | "warn" | "error";
      /** Arbitrary extra metadata. */
      extra?: unknown;
    },
  ) => CommonError;
}

// ─── Store Hook ──────────────────────────────────────────────────

/** Subscribe to the reactive TraceLogStore snapshot (for UI log viewers). */
export const useLoggerStore = () => {
  const traceLog = useSyncExternalStore(
    TraceLogStore.subscribe,
    TraceLogStore.getSnapshot,
  );

  return { traceLog };
};

// ─── Internal Helpers (pure functions, no React deps) ────────────

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

/**
 * Determine whether a message of the given level should be logged,
 * based on the current settings. Reads from a ref so it never causes
 * closure staleness while remaining referentially stable.
 */
function shouldLog(
  messageLevel: LogLevel,
  settingsRef: React.RefObject<ISettings>,
  prefix: string,
): boolean {
  const settings = settingsRef.current;
  if (!settings?.loggerConfig) return true;
  const { level, filterMode, filterList } = settings.loggerConfig;

  // Level check
  if (LOG_LEVEL_WEIGHT[messageLevel] > LOG_LEVEL_WEIGHT[level]) return false;

  // Filter check
  // If filter list is empty:
  //   - include mode → log nothing (strict allowlist)
  //   - exclude mode → log everything (strict blocklist)
  if (filterList.length === 0) return filterMode === "exclude";

  const match = filterList.includes(prefix);
  return filterMode === "include" ? match : !match;
}

/** Safely stringify an array of heterogeneous values for the trace log. */
function stringifyMessages(prefix: string, ...messages: unknown[]): string {
  const tag = prefix ? `[${prefix}] ` : "";
  const formatted = messages.map((msg) => {
    try {
      if (msg === undefined || msg === null) return typeof msg;
      if (typeof msg === "function")
        return `Function: ${msg.name || "anonymous"}`;
      if (typeof msg === "object") {
        try {
          return JSON.stringify(msg, null, 1);
        } catch (e: unknown) {
          return `Error stringifying object: ${(e as Error)?.message}`;
        }
      }
      if (typeof msg === "string") return msg;
      if (
        typeof msg === "number" ||
        typeof msg === "boolean" ||
        typeof msg === "bigint"
      ) {
        return msg.toString();
      }
      return "[Unknown type]";
    } catch (ex: unknown) {
      return `Error converting message to string: ${(ex as Error)?.message}`;
    }
  });
  return tag + formatted.join("");
}

// ─── Hook ────────────────────────────────────────────────────────

/**
 * Application logger with local trace logging. Returns a **referentially stable** object — safe to include in
 * useEffect / useCallback dependency arrays without causing re-renders.
 *
 * @param prefix - Optional label prepended to trace log entries and console output.
 */
export const useLogger = (prefix: string = ""): AppLogger => {
  const { settings } = useSettings();

  // Keep settings in a ref so the memoized closures always read the
  // latest value without needing settings in their dependency array.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // All returned functions are memoized with [prefix] as the only dep.
  // They read `settingsRef.current` at call-time, not at render-time.
  return useMemo<AppLogger>(() => {
    // ── Internal helpers ────────────────────────────────────────

    /** Write to the local trace log store. */
    const add = (message: string) => {
      if (!message) return;
      TraceLogStore.add(message);
    };

    /** Write to console if debugMode + logToConsole are enabled. */
    const toConsole = (
      level: "log" | "warn" | "error",
      color: string,
      messages: unknown[],
    ) => {
      const s = settingsRef.current;
      if (!s?.debugMode || !s.loggerConfig.logToConsole) return;

      if (prefix) {
        console[level](
          `%c[${prefix}]`,
          `color: ${color}; font-weight: bold;`,
          ...messages,
        );
      } else {
        console[level](...messages);
      }
    };

    // ── UI Channel ─────────────────────────────────────────────

    const log = (...messages: unknown[]) => {
      if (!shouldLog("info", settingsRef, prefix)) return;
      toConsole("log", "#0ea5e9", messages);
      add(stringifyMessages(prefix, ...messages));
    };

    const warn = (...messages: unknown[]) => {
      if (!shouldLog("warn", settingsRef, prefix)) return;
      toConsole("warn", "#eab308", messages);
      add(stringifyMessages(prefix, ...messages));
    };

    const error = (...messages: unknown[]) => {
      if (!shouldLog("error", settingsRef, prefix)) return;
      toConsole("error", "#ef4444", messages);
      add(stringifyMessages(prefix, ...messages));
    };

    const get = () => TraceLogStore.getSnapshot();
    const clear = () => TraceLogStore.clear();

    const UI: UILoggerChannel = {
      log,
      warn,
      error,
      get,
      clear,
    };

    // ── Error Handler ──────────────────────────────────────────

    /**
     * Handles errors in a standardized way:
     * - Parses error for details
     * - Logs to UI trace log
     */
    const handleError = (error: unknown, context?: string): CommonError => {
      const processedError = parseError(error);
      const message = context
        ? `[${context}] ${processedError.message}`
        : processedError.message;

      UI.error(message);
      return processedError;
    };

    return { UI, handleError };
  }, [prefix]);
};
