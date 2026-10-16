import { ArrowLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { type CSSProperties } from "react";
import { Link, useLocation, useMatches, useNavigate } from "react-router-dom";
import {
  getSectionSidebarGroups,
  type SectionSidebarType,
  type SectionSidebarGroup,
  type SectionSidebarItem,
} from "../config/section-sidebar";
import { useIdentity } from "../context/IdentityContext";
import { useSubscription } from "../hooks/useSubscription";
import { canManageSeatsAsAdminOrGlobal } from "../types/tenantRole";
import { isGlobalAdministrator } from "../utils/roles";
import type FeatureManagement from "../models/FeatureManagement";
import { cn } from "../lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../components/ui/sidebar";
import { useSettings } from "../context/SettingsContext";
interface SectionSidebarProps {
  type: SectionSidebarType;
  /** When false, hide sidebar logo (header shows it). Default true. */
  showEmbeddedLogo?: boolean;
  /** Desktop fixed sidebar position (below full-width header). */
  desktopContainerClassName?: string;
  backUrl?: string;
  backTitle?: string;
  backSubtitle?: string;
}

const sidebarStyle = {
  "--sidebar": "var(--primary-sidebar-bg)",
  "--sidebar-foreground": "var(--primary-sidebar-foreground)",
  "--sidebar-border": "var(--primary-sidebar-rail)",
  "--sidebar-accent": "var(--primary-sidebar-hover)",
  "--sidebar-accent-foreground": "var(--primary-sidebar-foreground)",
  "--sidebar-ring": "var(--primary-sidebar-rail)",
} as CSSProperties;

const sidebarClassName =
  "bg-[var(--primary-sidebar-bg)] text-[var(--primary-sidebar-foreground)]";

const smallLogoUrl = encodeURI("/vdab - logo small.png");
const fullLogoUrl = encodeURI("/vdab - logo.png");

const labelClassName =
  "mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary-sidebar-muted)]";

const buttonClassName =
  "group relative rounded-lg px-3 py-2 text-sm transition-all text-[var(--primary-sidebar-foreground)] hover:bg-[var(--primary-sidebar-hover)] hover:text-white data-[active=true]:bg-[var(--primary-sidebar-active)] data-[active=true]:text-white data-[active=true]:before:absolute data-[active=true]:before:bottom-0 data-[active=true]:before:left-0 data-[active=true]:before:top-0 data-[active=true]:before:w-1 data-[active=true]:before:bg-[var(--primary-sidebar-rail)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0";

const disabledClassName =
  "cursor-not-allowed opacity-65 hover:bg-transparent hover:text-[var(--primary-sidebar-foreground)]";

const footerButtonClassName =
  "rounded-lg px-3 py-2 text-[var(--primary-sidebar-foreground)] hover:bg-[var(--primary-sidebar-hover)] hover:text-white";

const footerSubtitleClassName = "text-white/70";

function isItemActive(
  pathname: string,
  matchIds: string[],
  item: SectionSidebarItem,
): boolean {
  if (item.matchIds?.some((matchId) => matchIds.includes(matchId))) {
    return true;
  }

  if (!item.url) return false;

  if (item.matchMode === "exact") {
    return pathname === item.url;
  }

  return pathname.startsWith(item.url);
}

function canManageAccountSeats(
  canUseSeatManagement: boolean,
  tenantRole: string | null | undefined,
  isGlobalAdministrator: boolean,
): boolean {
  return (
    canUseSeatManagement &&
    canManageSeatsAsAdminOrGlobal(tenantRole, isGlobalAdministrator)
  );
}

interface SectionSidebarMenuItemProps {
  item: SectionSidebarItem;
  isActive: boolean;
  fallbackUrl: string;
}

function SectionSidebarMenuItemLink({
  item,
  isActive,
  fallbackUrl,
}: Readonly<SectionSidebarMenuItemProps>) {
  const isDisabled = !item.url || item.disabled;
  const comingSoonSuffix = item.disabled ? " (Coming Soon)" : "";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={`${item.title}${item.disabled ? " (Coming soon)" : ""}`}
        data-active={isActive ? "true" : "false"}
        aria-disabled={isDisabled || undefined}
        className={cn(buttonClassName, isDisabled && disabledClassName)}
      >
        <Link
          to={item.url ?? fallbackUrl}
          tabIndex={isDisabled ? -1 : undefined}
          title={`${item.title}${comingSoonSuffix}`}
          onClick={
            isDisabled ? (event) => event.preventDefault() : undefined
          }
          className="flex w-full items-center justify-start gap-2 group-data-[collapsible=icon]:justify-center"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:sr-only">
            {item.title}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface SectionSidebarFooterProps {
  showBackButton: boolean;
  showCollapseControl: boolean;
  backUrl: string;
  backTitle: string;
  backSubtitle: string;
}

function SectionSidebarFooter({
  showBackButton,
  showCollapseControl,
  backUrl,
  backTitle,
  backSubtitle,
}: Readonly<SectionSidebarFooterProps>) {
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <SidebarFooter className="border-t border-white/10">
      {showBackButton ? (
        <SidebarMenu className="px-2 pt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate(backUrl)}
              className={footerButtonClassName}
            >
              <ArrowLeft className="h-4 w-4" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{backTitle}</span>
                <span
                  className={cn(
                    "truncate text-xs group-data-[collapsible=icon]:hidden",
                    footerSubtitleClassName,
                  )}
                >
                  {backSubtitle}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      ) : null}
      {showCollapseControl ? (
        <div className="flex justify-end px-2 pb-2 pt-1">
          <SidebarMenu className="w-full justify-end">
            <SidebarMenuItem className="flex justify-end">
              <SidebarMenuButton
                type="button"
                className={cn(footerButtonClassName, "w-fit gap-2")}
                onClick={toggleSidebar}
                aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
              >
                {isExpanded ? (
                  <ChevronsLeft className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronsRight className="h-4 w-4 shrink-0" />
                )}
                {isExpanded ? <span>Collapse</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      ) : null}
    </SidebarFooter>
  );
}

function filterGroupsByRole(
  groups: SectionSidebarGroup[],
  roles: string[],
  featureGates: FeatureManagement,
  canManageSeats: boolean,
  hasStripeBilling: boolean,
): SectionSidebarGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.disabled || featureGates.enablePreRelease) &&
          (!item.requiresTenantSeatManagement || canManageSeats) &&
          (!item.requiresStripeBilling || hasStripeBilling) &&
          (!item.requiredRoles ||
            item.requiredRoles.some((requiredRole) =>
              roles.includes(requiredRole),
            )),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function SectionSidebar({
  type,
  showEmbeddedLogo = true,
  desktopContainerClassName,
  backUrl = "/apps",
  backTitle = "Back",
  backSubtitle = "Return to Apps",
}: Readonly<SectionSidebarProps>) {
  const { user } = useIdentity();
  const location = useLocation();
  const matches = useMatches();
  const { featureGates } = useSettings();
  const { state } = useSidebar();
  const { canUseSeatManagement, hasStripeCustomer } = useSubscription({
    enabled: type === "account",
  });
  const canManageSeats = canManageAccountSeats(
    canUseSeatManagement,
    user?.tenantRole,
    isGlobalAdministrator(user),
  );
  const groups = getSectionSidebarGroups(type);
  const visibleGroups = filterGroupsByRole(
    groups,
    user?.roles ?? [],
    featureGates,
    canManageSeats,
    hasStripeCustomer,
  );
  const activeMatchIds = matches.map((match) => match.id);
  const showBackButton = type === "account";
  const showCollapseControl = type === "app" || type === "admin";
  /** Match horizontal inset used by admin secondary groups (Overview, Users, …). */
  const navGroupContentClassName = "px-2";
  const secondaryGroupContentClassName =
    type === "app" ? undefined : "mb-5 px-2";

  return (
    <Sidebar
      collapsible="icon"
      className={sidebarClassName}
      style={sidebarStyle}
      desktopContainerClassName={desktopContainerClassName}
    >
      <SidebarContent>
        <SidebarGroup>
          {showEmbeddedLogo ? (
            <div
              className={cn(
                "flex items-center justify-center",
                state === "collapsed" ? "py-2" : "py-3",
              )}
            >
              <img
                src={state === "collapsed" ? smallLogoUrl : fullLogoUrl}
                alt="VDAB Logo"
                className={cn(
                  "brightness-0 invert transition-all duration-200",
                  state === "collapsed" ? "h-8 w-8" : "h-11 w-auto",
                )}
              />
            </div>
          ) : null}

          {visibleGroups.map((group) => {
            const isNavGroup =
              group.title === "Navigation" &&
              (type === "app" || type === "admin");
            const groupContentClassName = isNavGroup
              ? navGroupContentClassName
              : secondaryGroupContentClassName;

            return (
              <SidebarGroupContent
                key={group.title}
                className={groupContentClassName}
              >
                <SidebarGroupLabel
                  className={cn(
                    labelClassName,
                    state === "collapsed" && "justify-center px-0",
                  )}
                >
                  {state === "collapsed" ? "•" : group.title}
                </SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isItemActive(
                      location.pathname,
                      activeMatchIds,
                      item,
                    );

                    return (
                      <SectionSidebarMenuItemLink
                        key={item.title}
                        item={item}
                        isActive={isActive}
                        fallbackUrl={location.pathname}
                      />
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            );
          })}
        </SidebarGroup>
      </SidebarContent>

      {(showBackButton || showCollapseControl) && (
        <SectionSidebarFooter
          showBackButton={showBackButton}
          showCollapseControl={showCollapseControl}
          backUrl={backUrl}
          backTitle={backTitle}
          backSubtitle={backSubtitle}
        />
      )}
    </Sidebar>
  );
}
