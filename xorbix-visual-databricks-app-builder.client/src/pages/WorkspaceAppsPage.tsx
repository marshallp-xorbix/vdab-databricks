import { useWorkspaceApps } from "../hooks/useWorkspaceApps";

interface IWorkspaceAppsPageProps {
  title?: string;
}

/** Displays apps visible to the user in the Databricks workspace hosting VDAB. */
function WorkspaceAppsPage({
  title = "Workspace apps",
}: Readonly<IWorkspaceAppsPageProps>) {
  const workspaceAppsQuery = useWorkspaceApps();
  const apps = workspaceAppsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const authenticationMode = workspaceAppsQuery.data?.pages[0]
    ?.authenticationMode;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apps in the Databricks workspace hosting this builder.
        </p>
      </header>

      {authenticationMode === "local-test" && (
        <p
          className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-foreground"
          role="status"
        >
          Local test mode: workspace app data is simulated and does not come
          from Databricks.
        </p>
      )}

      {workspaceAppsQuery.isPending ? (
        <p role="status" aria-live="polite">
          Loading workspace apps…
        </p>
      ) : workspaceAppsQuery.isError && !workspaceAppsQuery.data ? (
        <p role="alert">
          {workspaceAppsQuery.error instanceof Error
            ? workspaceAppsQuery.error.message
            : "Could not load workspace apps."}
        </p>
      ) : apps.length === 0 ? (
        <section
          aria-labelledby="workspace-apps-empty-heading"
          className="rounded-lg border border-dashed border-border p-8 text-center"
        >
          <h2
            id="workspace-apps-empty-heading"
            className="text-lg font-semibold"
          >
            No workspace apps found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Apps visible to your Databricks user will appear here.
          </p>
        </section>
      ) : (
        <>
          {workspaceAppsQuery.isError && (
            <p role="alert">
              {workspaceAppsQuery.error instanceof Error
                ? workspaceAppsQuery.error.message
                : "Could not load more workspace apps."}
            </p>
          )}
          <ul className="grid gap-4 sm:grid-cols-2">
            {apps.map((app) => (
              <li key={app.name}>
                <article className="h-full rounded-lg border border-border bg-card p-5">
                  <h2 className="break-words text-lg font-semibold">
                    {app.name}
                  </h2>
                  {app.description && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {app.description}
                    </p>
                  )}
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">App state</dt>
                    <dd>{app.appState ?? "Unknown"}</dd>
                    <dt className="text-muted-foreground">Compute state</dt>
                    <dd>{app.computeState ?? "Unknown"}</dd>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {workspaceAppsQuery.hasNextPage && (
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => void workspaceAppsQuery.fetchNextPage()}
          disabled={workspaceAppsQuery.isFetchingNextPage}
        >
          {workspaceAppsQuery.isFetchingNextPage
            ? "Loading more apps…"
            : "Load more apps"}
        </button>
      )}
    </main>
  );
}

export default WorkspaceAppsPage;
