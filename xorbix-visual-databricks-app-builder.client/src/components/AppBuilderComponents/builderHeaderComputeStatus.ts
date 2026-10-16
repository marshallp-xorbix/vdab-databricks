/**
 * Presentation for app compute status in the builder header (label, colors, toggle copy).
 * Keeps branching explicit instead of nested ternaries in the component.
 */

export type ComputeBadgeIcon = "unavailable" | "loading" | "dot";

export interface ComputeStatusPresentation {
  /** Full label, e.g. "App Compute Online" */
  statusLabel: string;
  /** Text after stripping "App Compute " for the compact badge */
  shortLabel: string;
  dotColorClass: string;
  /** Tailwind text-* class for the compact status label (aligned with dot / badge). */
  labelTextClass: string;
  dotPulse: boolean;
  badgeIcon: ComputeBadgeIcon;
  toggleAriaLabel: string;
  toggleTitle: string;
}

/** Visual + labels for a Databricks compute state string (e.g. ACTIVE, STOPPED). Shared with Apps list cards. */
export interface DatabricksComputeStatePresentation {
  statusLabel: string;
  shortLabel: string;
  dotColorClass: string;
  /** Tailwind text-* class aligned with the status dot color. */
  labelTextClass: string;
  dotPulse: boolean;
}

/**
 * Maps a Databricks app compute state (any casing) to labels and dot styling.
 */
export function getDatabricksComputeStatePresentation(
  rawState: string,
): DatabricksComputeStatePresentation {
  const effectiveState = rawState.trim().toUpperCase();
  const isRunning = effectiveState === "ACTIVE";
  const isStarting = effectiveState === "STARTING";
  const isStopping = effectiveState === "STOPPING";
  const isPending = ["STARTING", "STOPPING", "UPDATING", "DELETING"].includes(
    effectiveState,
  );

  if (isStarting) {
    return {
      statusLabel: "App Compute Starting",
      shortLabel: "Starting",
      dotColorClass: "bg-warning",
      labelTextClass: "text-warning",
      dotPulse: true,
    };
  }

  if (isStopping) {
    return {
      statusLabel: "App Compute Stopping",
      shortLabel: "Stopping",
      dotColorClass: "bg-warning",
      labelTextClass: "text-warning",
      dotPulse: true,
    };
  }

  if (isPending) {
    return {
      statusLabel: "App Compute Pending",
      shortLabel: "Pending",
      dotColorClass: "bg-warning",
      labelTextClass: "text-warning",
      dotPulse: true,
    };
  }

  if (isRunning) {
    return {
      statusLabel: "App Compute Online",
      shortLabel: "Online",
      dotColorClass: "bg-success",
      labelTextClass: "text-success",
      dotPulse: false,
    };
  }

  return {
    statusLabel: "App Compute Offline",
    shortLabel: "Offline",
    dotColorClass: "bg-destructive",
    labelTextClass: "text-destructive",
    dotPulse: false,
  };
}

function computeStateToggleCopy(effectiveState: string): {
  toggleAriaLabel: string;
  toggleTitle: string;
} {
  const s = effectiveState.trim().toUpperCase();
  if (s === "STARTING") {
    return {
      toggleAriaLabel: "App compute starting",
      toggleTitle: "App compute starting",
    };
  }
  if (s === "STOPPING") {
    return {
      toggleAriaLabel: "App compute stopping",
      toggleTitle: "App compute stopping",
    };
  }
  if (["STARTING", "STOPPING", "UPDATING", "DELETING"].includes(s)) {
    return {
      toggleAriaLabel: "App pending",
      toggleTitle: "App status pending",
    };
  }
  if (s === "ACTIVE") {
    return {
      toggleAriaLabel: "Stop app",
      toggleTitle: "Stop app",
    };
  }
  return {
    toggleAriaLabel: "Start app",
    toggleTitle: "Start app",
  };
}

export function getComputeStatusPresentation(input: {
  appId: number | null | undefined;
  isComputeUnavailable: boolean;
  isAwaitingInitialStatus: boolean;
  effectiveState: string;
}): ComputeStatusPresentation {
  const { appId, isComputeUnavailable, isAwaitingInitialStatus, effectiveState } =
    input;

  if (!appId) {
    return {
      statusLabel: "App Compute Unknown",
      shortLabel: "Unknown",
      dotColorClass: "bg-muted-foreground",
      labelTextClass: "text-muted-foreground",
      dotPulse: false,
      badgeIcon: "dot",
      toggleAriaLabel: "Save or open an app to control compute",
      toggleTitle: "Save or open an app to control it",
    };
  }

  if (isComputeUnavailable) {
    return {
      statusLabel: "App Compute Unavailable",
      shortLabel: "Unavailable",
      dotColorClass: "",
      labelTextClass: "text-destructive",
      dotPulse: false,
      badgeIcon: "unavailable",
      toggleAriaLabel: "App Compute Unavailable",
      toggleTitle: "App Compute Unavailable",
    };
  }

  if (isAwaitingInitialStatus) {
    return {
      statusLabel: "App Compute Loading",
      shortLabel: "Loading",
      dotColorClass: "bg-info",
      labelTextClass: "text-info",
      dotPulse: true,
      badgeIcon: "loading",
      toggleAriaLabel: "App compute status loading",
      toggleTitle: "Fetching app compute status",
    };
  }

  const visual = getDatabricksComputeStatePresentation(effectiveState);
  const toggles = computeStateToggleCopy(effectiveState);
  return {
    statusLabel: visual.statusLabel,
    shortLabel: visual.shortLabel,
    dotColorClass: visual.dotColorClass,
    labelTextClass: visual.labelTextClass,
    dotPulse: visual.dotPulse,
    badgeIcon: "dot",
    toggleAriaLabel: toggles.toggleAriaLabel,
    toggleTitle: toggles.toggleTitle,
  };
}
