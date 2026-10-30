import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Layers3,
  PanelsTopLeft,
  Settings2,
} from "lucide-react";
import { BrandedTopBar } from "../components/BrandedTopBar";
import { useProject } from "../hooks/useProject";
import { useWorkspaceSession } from "../hooks/useWorkspaceSession";
import BuilderNavigationLink from "./BuilderNavigationLink";
import StandaloneMobileNavigation from "./StandaloneMobileNavigation";
import { BUILDER_SECTIONS } from "./builderNavigation";
import { navigationClassName } from "./navigationClassName";

/** Navigation shell for the installed workspace-native product. */
function StandaloneAppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { appId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspaceSessionQuery = useWorkspaceSession();
  const workspaceUserIdentity =
    workspaceSessionQuery.data?.preferredUsername ??
    workspaceSessionQuery.data?.email ??
    "Databricks user";
  const isBuilderRoute = Boolean(appId) && location.pathname.startsWith("/apps/");
  const activeBuilderSection = searchParams.get("section") ?? "components";
  const projectQuery = useProject(isBuilderRoute ? appId : undefined);

  return (
    <div className={`flex flex-col bg-background text-foreground ${isBuilderRoute ? "h-svh overflow-hidden" : "min-h-svh"}`}>
      <a
        href="#page-content"
        className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      {isBuilderRoute ? (
        <BrandedTopBar
          variant="builder"
          builderAppTitle={projectQuery.data?.name ?? "App Builder"}
          workspaceUserLabel={getWorkspaceUserLabel(workspaceUserIdentity)}
          workspaceUserTitle={workspaceUserIdentity}
          showAccountRail={false}
          showSidebarTrigger={false}
        />
      ) : (
        <BrandedTopBar
          variant="apps"
          workspaceUserLabel={getWorkspaceUserLabel(workspaceUserIdentity)}
          workspaceUserTitle={workspaceUserIdentity}
          showAccountRail={false}
          showSidebarTrigger={false}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className={`hidden shrink-0 flex-col border-r border-border bg-background transition-[width] md:flex ${isSidebarCollapsed ? "w-16" : "w-56"}`}
        >
          <div className="px-4 pb-2 pt-5">
            {!isSidebarCollapsed && (
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                {isBuilderRoute ? "BUILDER" : "NAVIGATION"}
              </p>
            )}
          </div>
          {isBuilderRoute && appId ? (
            <nav aria-label="Builder navigation" className="grid gap-1 px-2">
              {BUILDER_SECTIONS.map((section) => (
                <BuilderNavigationLink
                  key={section.key}
                  appId={appId}
                  section={section.key}
                  label={section.label}
                  icon={<section.icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  isCollapsed={isSidebarCollapsed}
                  isSelected={activeBuilderSection === section.key}
                />
              ))}
            </nav>
          ) : (
            <nav aria-label="Main navigation" className="grid gap-1 px-2">
              <NavLink
                to="/apps"
                title={isSidebarCollapsed ? "Apps" : undefined}
                aria-label="Apps"
                className={({ isActive }) => navigationClassName(isActive, isSidebarCollapsed)}
              >
                <PanelsTopLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
                {!isSidebarCollapsed && <span>Apps</span>}
              </NavLink>
              <NavLink
                to="/workspace/apps"
                title={isSidebarCollapsed ? "Workspace apps" : undefined}
                aria-label="Workspace apps"
                className={({ isActive }) => navigationClassName(isActive, isSidebarCollapsed)}
              >
                <Layers3 aria-hidden="true" className="h-4 w-4 shrink-0" />
                {!isSidebarCollapsed && <span>Workspace apps</span>}
              </NavLink>
              <NavLink
                to="/databricks"
                title={isSidebarCollapsed ? "Workspace setup" : undefined}
                aria-label="Workspace setup"
                className={({ isActive }) => navigationClassName(isActive, isSidebarCollapsed)}
              >
                <Settings2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                {!isSidebarCollapsed && <span>Workspace setup</span>}
              </NavLink>
            </nav>
          )}
          <div className="mt-auto">
            {isBuilderRoute && !isSidebarCollapsed && (
              <Link
                to="/apps"
                className="flex min-h-12 items-center gap-2 border-t border-border px-3 text-sm text-foreground hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Apps</span>
              </Link>
            )}
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <StandaloneMobileNavigation
            appId={isBuilderRoute ? appId : undefined}
            activeBuilderSection={activeBuilderSection}
          />
          <div id="page-content" tabIndex={-1} className={`min-h-0 flex-1 ${isBuilderRoute ? "overflow-hidden" : ""}`}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

function getWorkspaceUserLabel(identity: string): string {
  if (!identity.includes("@")) return identity;

  const nameParts = identity
    .slice(0, identity.indexOf("@"))
    .split(/[._-]+/)
    .filter(Boolean);
  if (nameParts.length < 2) return identity;

  const displayParts =
    nameParts.length > 2 ? [nameParts[0], nameParts.at(-1)!] : nameParts;
  return displayParts
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export default StandaloneAppLayout;
