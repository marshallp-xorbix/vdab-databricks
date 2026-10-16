import {
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  LayoutDashboard,
  Settings,
  Workflow,
} from "lucide-react";
import { type ComponentType, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  useBuilderLayout,
  type BuilderMode,
} from "../context/BuilderLayoutContext";
type BuilderNavItem = {
  title: string;
  mode: BuilderMode;
  icon: ComponentType<{ className?: string }>;
};

const navItems: BuilderNavItem[] = [
  { title: "Canvas", mode: "canvas", icon: LayoutDashboard },
  { title: "Workflow", mode: "workflow", icon: Workflow },
  { title: "Code", mode: "code", icon: Code2 },
  { title: "Settings", mode: "settings", icon: Settings },
];

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

const footerButtonClassName =
  "rounded-lg px-3 py-2 text-[var(--primary-sidebar-foreground)] hover:bg-[var(--primary-sidebar-hover)] hover:text-white";

interface BuilderSidebarProps {
  /** Desktop fixed sidebar position (below full-width header). */
  desktopContainerClassName?: string;
}

export function BuilderSidebar({
  desktopContainerClassName,
}: Readonly<BuilderSidebarProps>) {
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
  const { builderMode, setBuilderMode } = useBuilderLayout();

  return (
    <Sidebar
      collapsible="icon"
      className={sidebarClassName}
      style={sidebarStyle}
      desktopContainerClassName={desktopContainerClassName}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              "mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary-sidebar-muted)]",
              state === "collapsed" && "justify-center px-0",
            )}
          >
            {state === "collapsed" ? "•" : "Builder"}
          </SidebarGroupLabel>

          <SidebarGroupContent className="px-2">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = builderMode === item.mode;
                return (
                  <SidebarMenuItem key={item.mode}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      data-active={isActive ? "true" : "false"}
                      onClick={() => setBuilderMode(item.mode)}
                      className={cn(
                        "group relative rounded-lg px-3 py-2 text-sm transition-all",
                        "text-[var(--primary-sidebar-foreground)] hover:bg-[var(--primary-sidebar-hover)] hover:text-white",
                        "data-[active=true]:bg-[var(--primary-sidebar-active)] data-[active=true]:text-white",
                        "data-[active=true]:before:absolute data-[active=true]:before:left-0 " +
                          "data-[active=true]:before:top-0 data-[active=true]:before:bottom-0 " +
                          "data-[active=true]:before:w-1 data-[active=true]:before:bg-[var(--primary-sidebar-rail)]",
                        "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:sr-only">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10">
        <div className="px-2 pb-2 pt-1">
          <SidebarMenu className="w-full">
            <SidebarMenuItem className="mb-1 flex">
              <SidebarMenuButton
                type="button"
                className={cn(
                  footerButtonClassName,
                  "gap-2",
                  state === "expanded" ? "w-full justify-start" : "w-fit",
                )}
                onClick={() => navigate("/apps")}
                aria-label="Back to Apps"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                {state === "expanded" ? <span>{"Back to Apps"}</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="flex">
              <SidebarMenuButton
                type="button"
                className={cn(
                  footerButtonClassName,
                  "gap-2",
                  state === "expanded" ? "w-full justify-start" : "w-fit",
                )}
                onClick={toggleSidebar}
                aria-label={
                  state === "expanded" ? "Collapse sidebar" : "Expand sidebar"
                }
              >
                {state === "expanded" ? (
                  <ChevronsLeft className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronsRight className="h-4 w-4 shrink-0" />
                )}
                {state === "expanded" ? <span>Collapse</span> : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
