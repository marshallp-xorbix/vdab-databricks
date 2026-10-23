import type { IWorkspaceSetupDiagnostics } from "../models/WorkspaceSetupDiagnostics";

interface IWorkspaceSetupDiagnosticsPanelProps {
  diagnostics: IWorkspaceSetupDiagnostics | undefined;
  error: Error | null;
  isChecking: boolean;
  onCheck: () => void;
}

function WorkspaceSetupDiagnosticsPanel({
  diagnostics,
  error,
  isChecking,
  onCheck,
}: Readonly<IWorkspaceSetupDiagnosticsPanelProps>) {
  return (
    <section
      aria-labelledby="diagnostics-heading"
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="diagnostics-heading" className="text-lg font-semibold">
            Setup diagnostics
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            The check reads Lakebase and default SQL warehouse configuration,
            plus your current app scopes using your signed-in user access. It never returns credentials and
            does not use the app identity as a fallback.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
          onClick={onCheck}
          disabled={isChecking}
        >
          {isChecking ? "Checking workspace…" : "Check workspace setup"}
        </button>
      </div>

      {!diagnostics && !isChecking && (
        <p
          className="mt-4 rounded-md border border-border p-3 text-sm text-muted-foreground"
          role="status"
        >
          Not checked. Opening this page does not make a setup diagnostic
          request.
        </p>
      )}

      {isChecking && (
        <p className="mt-4 text-sm" role="status" aria-live="polite">
          Checking the installed workspace with your current user authorization…
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      {diagnostics && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-live="polite">
          <article className="rounded-lg border border-border p-4">
            <h3 className="font-semibold">Lakebase connection fields</h3>
            <p className="mt-1 text-sm font-medium">
              {formatStatus(diagnostics.lakebase.status)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {diagnostics.lakebase.message}
            </p>
            {diagnostics.lakebase.configuredFields.length > 0 && (
              <p className="mt-3 text-sm">
                Present: {diagnostics.lakebase.configuredFields.join(", ")}
              </p>
            )}
            {diagnostics.lakebase.missingFields.length > 0 && (
              <p className="mt-2 text-sm">
                Missing: {diagnostics.lakebase.missingFields.join(", ")}
              </p>
            )}
          </article>

          <article className="rounded-lg border border-border p-4">
            <h3 className="font-semibold">Default SQL warehouse</h3>
            <p className="mt-1 text-sm font-medium">
              {formatStatus(diagnostics.defaultSqlWarehouse.status)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {diagnostics.defaultSqlWarehouse.message}
            </p>
          </article>

          <article className="rounded-lg border border-border p-4">
            <h3 className="font-semibold">Scopes and consent</h3>
            <p className="mt-1 text-sm font-medium">
              {formatStatus(diagnostics.authorization.status)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {diagnostics.authorization.message}
            </p>
            {diagnostics.authorization.requestedScopes.length > 0 && (
              <ScopeList
                label="Requested"
                scopes={diagnostics.authorization.requestedScopes}
              />
            )}
            {diagnostics.authorization.effectiveScopes.length > 0 && (
              <ScopeList
                label="Effective"
                scopes={diagnostics.authorization.effectiveScopes}
              />
            )}
            {diagnostics.authorization.consentedScopes.length > 0 && (
              <ScopeList
                label="Consented"
                scopes={diagnostics.authorization.consentedScopes}
              />
            )}
            {diagnostics.authorization.missingScopes.length > 0 && (
              <ScopeList
                label="Missing consent"
                scopes={diagnostics.authorization.missingScopes}
              />
            )}
          </article>
        </div>
      )}
    </section>
  );
}

interface IScopeListProps {
  label: string;
  scopes: string[];
}

function ScopeList({ label, scopes }: Readonly<IScopeListProps>) {
  return (
    <p className="mt-3 break-words text-sm">
      <span className="font-medium">{label}:</span> {scopes.join(", ")}
    </p>
  );
}

function formatStatus(status: string): string {
  switch (status) {
    case "configured":
      return "Inputs present";
    case "verified":
      return "Verified";
    case "incomplete":
      return "Incomplete";
    case "missing":
      return "Missing";
    case "invalid":
      return "Invalid configuration";
    case "missing-scopes":
      return "Consent needed";
    case "local-test":
      return "Simulated local test";
    default:
      return "Unable to verify";
  }
}

export default WorkspaceSetupDiagnosticsPanel;
