import { useEffect, useRef, useState } from "react";
import { useLogger, useLoggerStore } from "../logger/useLogger";
import { useSettings } from "../context/SettingsContext";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

interface IStatProps {
  label: string;
  value: string | number;
  ok?: boolean;
}

const formatEffectValue = (
  total: number,
  baselineLocked: boolean,
  extras: number,
): string => {
  const tail = baselineLocked ? `+${extras}` : "baseline pending";
  return `${total} (${tail})`;
};

const Stat = ({ label, value, ok }: Readonly<IStatProps>) => {
  let valueClass = "font-mono text-foreground";
  if (ok === true) valueClass = "font-mono text-success-foreground";
  else if (ok === false) valueClass = "font-mono text-destructive-foreground";
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
};

interface ISectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = ({ title, children }: Readonly<ISectionProps>) => (
  <div className="rounded border border-border bg-card p-4 shadow-sm">
    <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────
// Identity-tracking hook: counts renders + detects logger identity change
//
// NOTE on StrictMode: React 19 dev-mode StrictMode double-invokes mount
// effects (mount → cleanup → mount). So the initial effect-fire count
// stabilizes at 2, not 1. We capture that initial count as a "baseline"
// on the first render after effects have fired, and then report
// "extras since baseline" — that is the metric that matters when asking
// "would this logger cause my useEffect to re-fire?".
// ─────────────────────────────────────────────────────────────────

interface IIdentityStats {
  renderCount: number;
  loggerIdentityChanges: number;
  uiChannelChanges: number;
  logFnChanges: number;
  handleErrorChanges: number;
  effectFires_logger: number;
  effectFires_ui: number;
  effectFires_logFn: number;
  effectFires_handleError: number;
  effectBaselineLocked: boolean;
  effectExtras_logger: number;
  effectExtras_ui: number;
  effectExtras_logFn: number;
  effectExtras_handleError: number;
}

function useIdentityTracker(prefix: string): IIdentityStats {
  const logger = useLogger(prefix);

  const renderCount = useRef(0);
  renderCount.current += 1;

  // Identity tracking — refs only; we surface via state below.
  const lastLogger = useRef(logger);
  const lastUI = useRef(logger.UI);
  const lastLogFn = useRef(logger.UI.log);
  const lastHandleError = useRef(logger.handleError);

  const [identityCounts, setIdentityCounts] = useState({
    logger: 0,
    ui: 0,
    logFn: 0,
    handleError: 0,
  });

  if (
    lastLogger.current !== logger ||
    lastUI.current !== logger.UI ||
    lastLogFn.current !== logger.UI.log ||
    lastHandleError.current !== logger.handleError
  ) {
    const delta = {
      logger: lastLogger.current === logger ? 0 : 1,
      ui: lastUI.current === logger.UI ? 0 : 1,
      logFn: lastLogFn.current === logger.UI.log ? 0 : 1,
      handleError: lastHandleError.current === logger.handleError ? 0 : 1,
    };
    lastLogger.current = logger;
    lastUI.current = logger.UI;
    lastLogFn.current = logger.UI.log;
    lastHandleError.current = logger.handleError;
    // Schedule state update to surface the change; safe to call during
    // render because the predicate above prevents loops.
    setIdentityCounts((c) => ({
      logger: c.logger + delta.logger,
      ui: c.ui + delta.ui,
      logFn: c.logFn + delta.logFn,
      handleError: c.handleError + delta.handleError,
    }));
  }

  // Effect-fire tracking — stored in state so the UI reflects them.
  const [effectCounts, setEffectCounts] = useState({
    logger: 0,
    ui: 0,
    logFn: 0,
    handleError: 0,
  });

  // Baseline captured once after the first paint — represents the
  // "normal" initial mount cost (1 in production, 2 under StrictMode).
  const [baseline, setBaseline] = useState<typeof effectCounts | null>(null);

  useEffect(() => {
    setEffectCounts((c) => ({ ...c, logger: c.logger + 1 }));
  }, [logger]);

  useEffect(() => {
    setEffectCounts((c) => ({ ...c, ui: c.ui + 1 }));
  }, [logger.UI]);

  useEffect(() => {
    setEffectCounts((c) => ({ ...c, logFn: c.logFn + 1 }));
  }, [logger.UI.log]);

  useEffect(() => {
    setEffectCounts((c) => ({ ...c, handleError: c.handleError + 1 }));
  }, [logger.handleError]);

  // Lock baseline once: wait until all four counters are non-zero AND
  // give StrictMode a microtask to do its second pass, then freeze.
  useEffect(() => {
    if (baseline !== null) return;
    if (
      effectCounts.logger === 0 ||
      effectCounts.ui === 0 ||
      effectCounts.logFn === 0 ||
      effectCounts.handleError === 0
    ) {
      return;
    }
    const t = setTimeout(() => setBaseline(effectCounts), 50);
    return () => clearTimeout(t);
  }, [baseline, effectCounts]);

  return {
    renderCount: renderCount.current,
    loggerIdentityChanges: identityCounts.logger,
    uiChannelChanges: identityCounts.ui,
    logFnChanges: identityCounts.logFn,
    handleErrorChanges: identityCounts.handleError,
    effectFires_logger: effectCounts.logger,
    effectFires_ui: effectCounts.ui,
    effectFires_logFn: effectCounts.logFn,
    effectFires_handleError: effectCounts.handleError,
    effectBaselineLocked: baseline !== null,
    effectExtras_logger:
      baseline === null ? 0 : effectCounts.logger - baseline.logger,
    effectExtras_ui: baseline === null ? 0 : effectCounts.ui - baseline.ui,
    effectExtras_logFn:
      baseline === null ? 0 : effectCounts.logFn - baseline.logFn,
    effectExtras_handleError:
      baseline === null ? 0 : effectCounts.handleError - baseline.handleError,
  };
}

// ─────────────────────────────────────────────────────────────────
// Sibling: subscribes to logger store. Should re-render on every log.
// ─────────────────────────────────────────────────────────────────

const SubscriberSibling = () => {
  const { traceLog } = useLoggerStore();
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <div className="space-y-2">
      <Stat label="Sibling renders (subscribed)" value={renderCount.current} />
      <Stat label="Trace log length" value={traceLog.length} />
      <div className="max-h-40 overflow-auto rounded border border-border bg-muted p-2 font-mono text-xs">
        {traceLog.length === 0 ? (
          <span className="text-muted-foreground">(empty)</span>
        ) : (
          traceLog.slice(-10).map((line, idx) => (
            <div key={`${idx}-${line.slice(0, 16)}`} className="truncate">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Sibling: uses useLogger only (no store). Should NOT re-render on log.
// ─────────────────────────────────────────────────────────────────

const NonSubscriberSibling = () => {
  const logger = useLogger("non-subscriber");
  const renderCount = useRef(0);
  renderCount.current += 1;

  const lastLogger = useRef(logger);
  const identityChanges = useRef(0);
  if (lastLogger.current !== logger) {
    identityChanges.current += 1;
    lastLogger.current = logger;
  }

  return (
    <div className="space-y-1">
      <Stat
        label="Sibling renders (NOT subscribed)"
        value={renderCount.current}
      />
      <Stat
        label="Logger identity changes"
        value={identityChanges.current}
        ok={identityChanges.current === 0}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Sibling: same prefix, different component instance.
// Each component instance has its own memoized logger, so identities
// will differ between siblings even with the same prefix.
// ─────────────────────────────────────────────────────────────────

interface IPrefixedProbeProps {
  prefix: string;
  label: string;
}

const PrefixedProbe = ({ prefix, label }: Readonly<IPrefixedProbeProps>) => {
  const logger = useLogger(prefix);
  const idRef = useRef<string>("");
  if (idRef.current === "") {
    idRef.current = Math.random().toString(36).slice(2, 8);
  }
  return (
    <Stat
      label={`${label} (prefix="${prefix}")`}
      value={`obj#${idRef.current} log=${logger.UI.log.name || "fn"}`}
    />
  );
};

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

const LoggerTestPage = () => {
  const logger = useLogger("logger-test");
  const stats = useIdentityTracker("logger-test");
  const { settings, setSettings } = useSettings();

  const [reRenderTick, setReRenderTick] = useState(0);

  const forceReRender = () => setReRenderTick((n) => n + 1);

  const toggleDebugMode = () =>
    setSettings((s) => ({ ...s, debugMode: !s.debugMode }));

  const toggleLogToConsole = () =>
    setSettings((s) => ({
      ...s,
      loggerConfig: {
        ...s.loggerConfig,
        logToConsole: !s.loggerConfig.logToConsole,
      },
    }));

  const spam = () => {
    for (let i = 0; i < 100; i += 1) {
      logger.UI.log(`spam #${i}`);
    }
  };

  const triggerHandledError = () => {
    try {
      throw new Error("Synthetic boom for handleError()");
    } catch (e) {
      logger.handleError(e, "LoggerTestPage.triggerHandledError");
    }
  };

  const identityOk = stats.loggerIdentityChanges === 0;
  const uiOk = stats.uiChannelChanges === 0;
  const logFnOk = stats.logFnChanges === 0;
  const handleErrorOk = stats.handleErrorChanges === 0;
  // Once the baseline is locked, any further effect fires would indicate
  // an unstable dep. Before baseline lock, treat as not-yet-determined.
  const effectOk =
    !stats.effectBaselineLocked ||
    (stats.effectExtras_logger === 0 &&
      stats.effectExtras_ui === 0 &&
      stats.effectExtras_logFn === 0 &&
      stats.effectExtras_handleError === 0);

  const allOk = identityOk && uiOk && logFnOk && handleErrorOk && effectOk;
  const verdictClass = allOk
    ? "font-semibold text-success-foreground"
    : "font-semibold text-destructive-foreground";
  let verdictText = "UNSTABLE — would cause effect re-runs";
  if (allOk && stats.effectBaselineLocked) {
    verdictText = "STABLE — safe to use as useEffect dep";
  } else if (allOk) {
    verdictText = "STABLE so far — waiting for effect baseline…";
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          useLogger stability test
        </h1>
        <p className="text-sm text-muted-foreground">
          Validates that <code>useLogger()</code> returns a referentially stable
          object across renders and settings changes, so it is safe to include
          in <code>useEffect</code> dependency arrays. Remove this page before
          shipping.
        </p>
      </header>

      <Section title="Controls">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={forceReRender}
            className="rounded bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90"
          >
            Force re-render (tick={reRenderTick})
          </button>
          <button
            type="button"
            onClick={toggleDebugMode}
            className="rounded bg-muted px-3 py-1.5 text-sm hover:bg-muted"
          >
            Toggle debugMode ({String(settings.debugMode)})
          </button>
          <button
            type="button"
            onClick={toggleLogToConsole}
            className="rounded bg-muted px-3 py-1.5 text-sm hover:bg-muted"
          >
            Toggle logToConsole ({String(settings.loggerConfig.logToConsole)})
          </button>
          <button
            type="button"
            onClick={() => logger.UI.clear()}
            className="rounded bg-warning-subtle px-3 py-1.5 text-sm hover:bg-warning/30"
          >
            Clear trace log
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => logger.UI.log("UI.log @", new Date().toISOString())}
            className="rounded bg-info px-3 py-1.5 text-sm text-white hover:bg-info/90"
          >
            UI.log
          </button>
          <button
            type="button"
            onClick={() =>
              logger.UI.warn("UI.warn @", new Date().toISOString())
            }
            className="rounded bg-warning px-3 py-1.5 text-sm text-white hover:bg-warning"
          >
            UI.warn
          </button>
          <button
            type="button"
            onClick={() =>
              logger.UI.error("UI.error @", new Date().toISOString())
            }
            className="rounded bg-destructive px-3 py-1.5 text-sm text-white hover:bg-destructive/90"
          >
            UI.error
          </button>
          <button
            type="button"
            onClick={() => logger.AI.info("AI.info ping")}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
          >
            AI.info
          </button>
          <button
            type="button"
            onClick={() => logger.AI.warning("AI.warning ping")}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
          >
            AI.warning
          </button>
          <button
            type="button"
            onClick={() => logger.AI.error("AI.error ping")}
            className="rounded bg-indigo-700 px-3 py-1.5 text-sm text-white hover:bg-indigo-600"
          >
            AI.error
          </button>
          <button
            type="button"
            onClick={() => logger.AI.event("LoggerTest.ButtonClicked")}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-500"
          >
            AI.event
          </button>
          <button
            type="button"
            onClick={triggerHandledError}
            className="rounded bg-destructive px-3 py-1.5 text-sm text-white hover:bg-destructive/90"
          >
            handleError
          </button>
          <button
            type="button"
            onClick={spam}
            className="rounded bg-success px-3 py-1.5 text-sm text-white hover:bg-success"
          >
            Spam 100 logs
          </button>
        </div>
      </Section>

      <Section title="Identity stability (main page)">
        <Stat label="Renders" value={stats.renderCount} />
        <Stat
          label="logger identity changes"
          value={stats.loggerIdentityChanges}
          ok={identityOk}
        />
        <Stat
          label="logger.UI identity changes"
          value={stats.uiChannelChanges}
          ok={uiOk}
        />
        <Stat
          label="logger.UI.log identity changes"
          value={stats.logFnChanges}
          ok={logFnOk}
        />
        <Stat
          label="logger.handleError identity changes"
          value={stats.handleErrorChanges}
          ok={handleErrorOk}
        />
        <Stat
          label={`useEffect[logger] fires (extras since baseline)`}
          value={formatEffectValue(
            stats.effectFires_logger,
            stats.effectBaselineLocked,
            stats.effectExtras_logger,
          )}
          ok={!stats.effectBaselineLocked || stats.effectExtras_logger === 0}
        />
        <Stat
          label={`useEffect[logger.UI] fires (extras since baseline)`}
          value={formatEffectValue(
            stats.effectFires_ui,
            stats.effectBaselineLocked,
            stats.effectExtras_ui,
          )}
          ok={!stats.effectBaselineLocked || stats.effectExtras_ui === 0}
        />
        <Stat
          label={`useEffect[logger.UI.log] fires (extras since baseline)`}
          value={formatEffectValue(
            stats.effectFires_logFn,
            stats.effectBaselineLocked,
            stats.effectExtras_logFn,
          )}
          ok={!stats.effectBaselineLocked || stats.effectExtras_logFn === 0}
        />
        <Stat
          label={`useEffect[logger.handleError] fires (extras since baseline)`}
          value={formatEffectValue(
            stats.effectFires_handleError,
            stats.effectBaselineLocked,
            stats.effectExtras_handleError,
          )}
          ok={
            !stats.effectBaselineLocked || stats.effectExtras_handleError === 0
          }
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Initial mount fires {`>= 1`} (and {`= 2`} under React 19 StrictMode in
          dev). Baseline locks ~50ms after first paint. Only "extras since
          baseline" indicate an unstable dependency.
        </p>
        <p className="mt-3 text-sm">
          Overall: <span className={verdictClass}>{verdictText}</span>
        </p>
      </Section>

      <Section title="Subscriber isolation">
        <p className="mb-2 text-sm text-muted-foreground">
          The non-subscriber sibling should never re-render when logs are added;
          the subscriber should re-render once per added entry.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <SubscriberSibling />
          </div>
          <div>
            <NonSubscriberSibling />
          </div>
        </div>
      </Section>

      <Section title="Prefix-based memoization">
        <p className="mb-2 text-sm text-muted-foreground">
          Each component instance has its own memoized logger. Identities differ
          between siblings; the same instance keeps the same identity across
          renders.
        </p>
        <PrefixedProbe prefix="alpha" label="Probe A" />
        <PrefixedProbe prefix="alpha" label="Probe B (same prefix)" />
        <PrefixedProbe prefix="beta" label="Probe C (different prefix)" />
      </Section>
    </div>
  );
};

export default LoggerTestPage;
