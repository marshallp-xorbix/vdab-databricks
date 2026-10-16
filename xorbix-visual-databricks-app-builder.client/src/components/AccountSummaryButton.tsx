import { ChevronsUpDown } from "lucide-react";
import { SidebarMenuButton } from "./ui/sidebar";

interface AccountSummaryButtonProps {
  readonly user: {
    email?: string;
    fullName?: string;
  };
  readonly currentTenantName: string;
  readonly isCurrentTenantDefault: boolean;
  readonly onClick: () => void;
  readonly variant?: "sidebar" | "header";
  readonly headerDisplay?: "full" | "nameOnly";
}

function AccountSummaryButton({
  user,
  currentTenantName,
  isCurrentTenantDefault,
  onClick,
  variant = "sidebar",
  headerDisplay = "full",
}: AccountSummaryButtonProps) {
  const userDisplayName = user.fullName || user.email?.split("@")[0] || "User";
  const userInitial = user.email?.[0]?.toUpperCase() ?? "U";

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Open account menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-white/90 transition-colors hover:bg-white/10"
      >
        <span className="relative flex size-8 shrink-0 overflow-hidden rounded-full">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
            {userInitial}
          </div>
        </span>
        <div className="hidden max-w-40 text-left lg:block">
          <div className="truncate text-sm font-medium text-white">
            {userDisplayName}
          </div>
          {headerDisplay === "full" && (
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs text-white/70">
                {currentTenantName}
              </span>
              {isCurrentTenantDefault && (
                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90">
                  Default
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronsUpDown className="size-4 text-white/70" />
      </button>
    );
  }

  return (
    <SidebarMenuButton
      size="lg"
      onClick={onClick}
      className="rounded-lg px-3 py-2 hover:bg-muted/70"
    >
      <span className="relative flex size-8 shrink-0 overflow-hidden rounded-lg">
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-medium">
          {userInitial}
        </div>
      </span>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{userDisplayName}</span>
        <span className="truncate text-xs group-data-[collapsible=icon]:hidden text-muted-foreground">
          {user.email}
        </span>
        <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-xs text-muted-foreground">
            {currentTenantName}
          </span>
          {isCurrentTenantDefault && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Default
            </span>
          )}
        </div>
      </div>
      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
    </SidebarMenuButton>
  );
}

export default AccountSummaryButton;
