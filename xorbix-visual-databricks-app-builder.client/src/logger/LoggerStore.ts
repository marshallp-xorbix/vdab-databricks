import type { IApplicationLog } from "../types/IApplicationLog";

// Internal shared ref
const logRef: IApplicationLog[] = [];

// Listener subscribers
const listeners: Set<() => void> = new Set();
// Keep the last stable snapshot reference
let cachedSnapshot: IApplicationLog[] = logRef;

// Notify all subscribers
const notify = () => {
  // Create a new snapshot only when logRef changes
  cachedSnapshot = [...logRef];
  listeners.forEach((cb) => cb());
};

const format = (...messages: unknown[]) =>
  messages
    .map((msg) => {
      if (typeof msg === "string") return msg;
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return "[Unserializable]";
      }
    })
    .join(" ");

/**
 * Add messages to the application log. Intended for logging general information messages intended for end users.
 * @param msg
 */
export const ApplicationLogStore = {
  log: (...msg: unknown[]) => {
    // type: 'info' | 'warning' | 'error' = 'info'
    logRef.push({
      message: format(...msg),
      type: "info",
      timestamp: new Date().toISOString(),
    });

    // Optional: trim if too long
    // if (logRef.length > 1250) {
    //   logRef.splice(0, logRef.length - 1000);
    // }

    notify(); // Tell subscribers the logs changed
  },
  warn: (...msg: unknown[]) => {
    // type: 'info' | 'warning' | 'error' = 'info'
    logRef.push({
      message: format(...msg),
      type: "warning",
      timestamp: new Date().toISOString(),
    });
    notify(); // Tell subscribers the logs changed
  },
  error: (...msg: unknown[]) => {
    // type: 'info' | 'warning' | 'error' = 'info'
    logRef.push({
      message: format(...msg),
      type: "error",
      timestamp: new Date().toISOString(),
    });
    notify(); // Tell subscribers the logs changed
  },

  clear: () => {
    logRef.length = 0;
    cachedSnapshot = []; // Clear the cache too
    notify();
  },

  getSnapshot: () => cachedSnapshot,

  subscribe: (callback: () => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};

const traceRef: string[] = [];
const traceListeners = new Set<() => void>();
let cachedTraceSnapshot: string[] = traceRef;
const notifyTrace = () => {
  // Create a new snapshot only when logRef changes
  cachedTraceSnapshot = [...traceRef];
  traceListeners.forEach((cb) => cb());
};

/**
 * Trace log store for detailed trace logs. Intended for logging detailed technical information for debugging purposes.
 */
export const TraceLogStore = {
  add: (message: string) => {
    if (!message) return;
    traceRef.push(message);
    if (traceRef.length > 1250) traceRef.splice(0, traceRef.length - 1000);
    notifyTrace();
  },
  clear: () => {
    traceRef.length = 0;
    cachedTraceSnapshot = []; // Clear the cache too
    notifyTrace();
  },
  getSnapshot: () => cachedTraceSnapshot,
  subscribe: (cb: () => void) => {
    traceListeners.add(cb);
    return () => traceListeners.delete(cb);
  },
};
