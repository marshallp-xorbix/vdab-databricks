import { Outlet, useNavigate, useMatches } from "react-router-dom";
import { useIdentity } from "../context/IdentityContext";
import { useTenantContext } from "../hooks/useTenantContext";
import { ComponentRegistryProvider } from "../context/ComponentRegistryContext";
import { SidebarProvider } from "../components/ui/sidebar";
import { BuilderSidebar } from "../components/builder-sidebar";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import PausedAccountBanner from "../components/PausedAccountBanner";
import NoActiveWorkspaceBanner from "../components/NoActiveWorkspaceBanner";
import { AuthenticatedHeader } from "../components/authenticated-header.tsx";
import { BrandedTopBar } from "../components/BrandedTopBar";
import {
  BuilderLayoutProvider,
  useBuilderLayout,
} from "../context/BuilderLayoutContext";
import { cn } from "../lib/utils";
import { useAccountSetupStatus } from "../hooks/useAccountSetupStatus";
import { SectionSidebar } from "../components/section-sidebar";
import { useLogger } from "../logger/useLogger";
import { AuthPageShell } from "../components/AuthPageShell";
import {
  authSpinnerClassName,
  BACKGROUND_URL,
} from "../constants/authBranding";
import { useTheme } from "../context/ThemeContext";

function BuilderAuthenticatedShell({
  banner,
  tenantScopeKey,
}: Readonly<{ banner?: ReactNode; tenantScopeKey: string }>) {
  const { headerAppTitle } = useBuilderLayout();
  const sidebarBelowHeaderClass =
    "top-16 bottom-0 h-[calc(100svh-4rem)] min-h-0";

  return (
    <SidebarProvider className="flex h-svh flex-col overflow-hidden overscroll-none">
      <BrandedTopBar variant="builder" builderAppTitle={headerAppTitle} />
      {banner}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <BuilderSidebar desktopContainerClassName={sidebarBelowHeaderClass} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main className="min-h-0 flex-1 overflow-hidden overscroll-none">
            <ComponentRegistryProvider key={tenantScopeKey}>
              <Outlet />
            </ComponentRegistryProvider>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const AuthenticatedLayout = () => {
  const { user, isLoading, isLoaded } = useIdentity();
  const { currentTenant, tenants, isLoading: isTenantLoading, isSwitching } =
    useTenantContext();
  const navigate = useNavigate();
  const matches = useMatches();
  const logger = useLogger("AuthenticatedLayout");
  const tenantScopeKey =
    currentTenant?.tenantId ?? user?.tenantId ?? "no-tenant";

  const isAdminRoute = matches.some((m) => m.id === "admin-layout");
  const isAccountRoute = matches.some((m) => m.id === "account-layout");
  const isBuilderRoute = matches.some((m) => m.id === "app-builder");
  const isAppsListRoute = matches.some((m) => m.id === "apps-list");
  const isDatabricksListRoute = matches.some((m) => m.id === "databricks-list");
  const isDatabricksCallbackRoute = matches.some(
    (m) => m.id === "databricks-callback",
  );
  const useBrandedTopBar =
    (isAppsListRoute ||
      isAdminRoute ||
      isDatabricksListRoute ||
      isDatabricksCallbackRoute) &&
    !isBuilderRoute;
  /** Develop light: site-background image. Dark: flat VS Code ground. */
  const useBrandedBackground =
    (useBrandedTopBar || isAccountRoute) && !isBuilderRoute;
  const { theme } = useTheme();
  const useSiteBackgroundImage = useBrandedBackground && theme === "light";
  const useFlatDarkBackground = useBrandedBackground && theme === "dark";
  const hasAdminAccess =
    !isAdminRoute || !!user?.roles?.includes("Administrator");
  const shouldCheckSetup =
    isLoaded && !isLoading && !!user && hasAdminAccess && !isSwitching;

  const setupStatusQuery = useAccountSetupStatus({
    userId: user?.userId,
    tenantId: user?.tenantId ?? currentTenant?.tenantId,
    enabled: shouldCheckSetup,
  });

  // Suspended/removed from every workspace is not a billing problem — show the banner
  // instead of pushing the user through subscription setup.
  const hasNoActiveWorkspace =
    !isTenantLoading &&
    tenants.length === 0 &&
    !user?.roles?.includes("Administrator");

  useEffect(() => {
    if (!isLoaded || isLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (isAdminRoute && !user.roles?.includes("Administrator")) {
      navigate("/apps");
    }
  }, [user, isLoaded, isLoading, navigate, isAdminRoute]);

  // Future pre-requisite checks can be layered onto this redirect flow without reintroducing per-render fetches.
  useEffect(() => {
    if (isSwitching) return;
    if (!setupStatusQuery.data) return;

    if (setupStatusQuery.data.needsPolicyAcceptance) {
      navigate("/account/policy-acceptance", { replace: true });
      return;
    }

    if (hasNoActiveWorkspace) return;

    if (
      !setupStatusQuery.data.isSetupComplete &&
      setupStatusQuery.data.currentStep
    ) {
      navigate("/account/setup/billing", { replace: true });
    }
  }, [setupStatusQuery.data, navigate, isSwitching, hasNoActiveWorkspace]);

  useEffect(() => {
    if (!setupStatusQuery.error) return;

    // If setup status check fails, allow access rather than blocking.
    logger.handleError(setupStatusQuery.error, "Setup status check failed");
  }, [setupStatusQuery.error, logger]);

  const isCheckingSetup = shouldCheckSetup && setupStatusQuery.isPending;
  const needsSetupRedirect =
    !isSwitching &&
    !!setupStatusQuery.data &&
    (setupStatusQuery.data.needsPolicyAcceptance ||
      (!hasNoActiveWorkspace &&
        !setupStatusQuery.data.isSetupComplete &&
        !!setupStatusQuery.data.currentStep));

  if (
    !isLoaded ||
    isLoading ||
    isSwitching ||
    isCheckingSetup ||
    needsSetupRedirect
  ) {
    return (
      <AuthPageShell>
        <Loader2 className={`h-12 w-12 animate-spin ${authSpinnerClassName}`} />
      </AuthPageShell>
    );
  }

  if (!user) return null; // Will redirect
  if (isAdminRoute && !user.roles?.includes("Administrator")) return null; // Will redirect

  let shellType: "app" | "account" | "admin" = "app";
  if (isAdminRoute) {
    shellType = "admin";
  } else if (isAccountRoute) {
    shellType = "account";
  }

  const pausedBanner = setupStatusQuery.data?.isPaused ? (
    <PausedAccountBanner />
  ) : null;
  // Full empty-state (below) carries the Detached CTAs; skip the thin top banner there.
  const noWorkspaceBanner =
    hasNoActiveWorkspace && (isAccountRoute || isAdminRoute || isBuilderRoute) ? (
      <NoActiveWorkspaceBanner />
    ) : null;
  const banners = (
    <>
      {pausedBanner}
      {noWorkspaceBanner}
    </>
  );

  if (isBuilderRoute) {
    return (
      <BuilderLayoutProvider>
        <BuilderAuthenticatedShell
          banner={banners}
          tenantScopeKey={tenantScopeKey}
        />
      </BuilderLayoutProvider>
    );
  }

  const sidebarBelowHeaderClass =
    "top-16 bottom-0 h-[calc(100svh-4rem)] min-h-0";

  return (
    <SidebarProvider className="flex h-svh flex-col overflow-hidden overscroll-none">
      {useBrandedTopBar ? (
        <BrandedTopBar variant={isAdminRoute ? "admin" : "apps"} />
      ) : (
        <AuthenticatedHeader type={shellType} />
      )}
      {banners}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <SectionSidebar
          type={shellType}
          showEmbeddedLogo={shellType === "account"}
          desktopContainerClassName={sidebarBelowHeaderClass}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <main
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-none",
              useSiteBackgroundImage &&
                "relative bg-cover bg-center bg-no-repeat",
              useFlatDarkBackground && "bg-background",
            )}
            style={
              useSiteBackgroundImage
                ? {
                    backgroundImage: `url("${BACKGROUND_URL}")`,
                    backgroundAttachment: "fixed",
                  }
                : undefined
            }
          >
            <div
              className={cn(useBrandedBackground && "relative z-10 w-full")}
            >
              {hasNoActiveWorkspace && !isAccountRoute && !isAdminRoute ? (
                <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    No active workspace
                  </h1>
                  <p className="text-muted-foreground">
                    You are signed in, but you are not a member of any active
                    workspace. Create one below, or use an invite link from your
                    team. Your account itself is unchanged.
                  </p>
                  <NoActiveWorkspaceBanner />
                </div>
              ) : (
                <ComponentRegistryProvider key={tenantScopeKey}>
                  <Outlet />
                </ComponentRegistryProvider>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AuthenticatedLayout;
