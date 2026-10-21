import { Link } from "react-router-dom";
import { useWorkspaceSession } from "../hooks/useWorkspaceSession";

/** Shows identity and install-local setup guidance without requesting credentials. */
function WorkspaceSetupPage() {
  const sessionQuery = useWorkspaceSession();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace setup
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          VDAB uses the Databricks workspace where this installation runs. It
          does not connect to another workspace or ask you for a personal token.
        </p>
      </header>

      {sessionQuery.isPending ? (
        <p role="status" aria-live="polite">
          Checking the installed workspace session…
        </p>
      ) : sessionQuery.isError ? (
        <section className="rounded-lg border border-destructive/40 p-5">
          <h2 className="font-semibold">Workspace session unavailable</h2>
          <p className="mt-2 text-sm" role="alert">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Open VDAB through Databricks and confirm your app access."}
          </p>
        </section>
      ) : sessionQuery.data ? (
        <>
          {sessionQuery.data.authenticationMode === "local-test" && (
            <p
              className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-foreground"
              role="status"
            >
              Local test mode: the identity and workspace below are simulated.
              This does not verify Databricks sign-in or resource access.
            </p>
          )}

          <section
            aria-labelledby="session-heading"
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 id="session-heading" className="text-lg font-semibold">
              Installed workspace session
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Signed-in user</dt>
                <dd className="break-all font-medium">
                  {sessionQuery.data.preferredUsername ??
                    sessionQuery.data.email ??
                    sessionQuery.data.userId}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Workspace</dt>
                <dd className="break-all font-medium">
                  {sessionQuery.data.workspace.host ?? "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Workspace ID</dt>
                <dd className="font-medium">
                  {sessionQuery.data.workspace.id ?? "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Install recovery access</dt>
                <dd className="font-medium">
                  {sessionQuery.data.installationAdmin
                    ? "Configured"
                    : "Not configured for this user"}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="requirements-heading"
            className="rounded-xl border border-border bg-card p-5"
          >
            <h2 id="requirements-heading" className="text-lg font-semibold">
              Resource and permission setup
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                The workspace administrator binds an existing customer-owned
                Lakebase Autoscaling database to VDAB for durable project data.
              </li>
              <li>
                Databricks user scopes and resource permissions are checked when
                you browse or use each workspace feature. A denial is shown by
                that feature; VDAB does not retry it as the app identity.
              </li>
              <li>
                Select a customer model endpoint in AI Builder when you edit a
                project. Endpoint access and inference cost remain controlled by
                the workspace.
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="rounded-md border border-border px-4 py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                to="/apps"
              >
                Open projects
              </Link>
              <Link
                className="rounded-md border border-border px-4 py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                to="/workspace/apps"
              >
                Browse workspace apps
              </Link>
              <a
                className="rounded-md border border-border px-4 py-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                href="https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources"
                target="_blank"
                rel="noreferrer"
              >
                Databricks App resource guide
              </a>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default WorkspaceSetupPage;
