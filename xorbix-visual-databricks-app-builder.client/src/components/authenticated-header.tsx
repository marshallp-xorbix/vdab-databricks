import { useState } from "react";
import { useIdentity } from "../context/IdentityContext";
import { useTenantContext } from "../hooks/useTenantContext";
import { cn } from "../lib/utils";
import { SidebarTrigger } from "../components/ui/sidebar";
import AccountSummaryButton from "./AccountSummaryButton";
import AccountWorkspaceMenu from "./AccountWorkspaceMenu";
import { Breadcrumb } from "./Breadcrumb";

export type AuthenticatedHeaderType = "app" | "account" | "admin";

interface AuthenticatedHeaderProps {
  type?: AuthenticatedHeaderType;
}

export function AuthenticatedHeader({
  type = "app",
}: Readonly<AuthenticatedHeaderProps>) {
  const { user } = useIdentity();
  const { currentTenant } = useTenantContext();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header
      className={cn(
        "chrome-inside-blue-glow chrome-inside-blue-glow--no-sides shell-header-chrome flex h-16 shrink-0 items-center gap-3 border-b border-white/20 text-white",
        type === "app" ? "px-3" : "px-4 md:px-5",
      )}
    >
      <SidebarTrigger className="-ml-1 text-white hover:bg-white/10" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Breadcrumb />
      </div>

      {user ? (
        <div className="relative flex items-center gap-1 border-l border-white/20 pl-3">
          <AccountSummaryButton
            user={user}
            currentTenantName={
              currentTenant?.displayName ?? "No active organization"
            }
            isCurrentTenantDefault={Boolean(currentTenant?.isDefault)}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            variant="header"
            headerDisplay="nameOnly"
          />
          {showProfileMenu ? (
            <AccountWorkspaceMenu
              onClose={() => setShowProfileMenu(false)}
              variant="header"
            />
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
