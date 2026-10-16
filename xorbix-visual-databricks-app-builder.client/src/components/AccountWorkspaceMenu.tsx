import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  SUPPORT_PORTAL_URL,
  WHATS_NEW_URL,
} from "../constants/supportLinks";
import { useIdentity } from "../context/IdentityContext";
import { useTenantContext } from "../hooks/useTenantContext";
import { cn } from "../lib/utils";
import { identityApi } from "../providers/IdentityApi";
import { useLogger } from "../logger/useLogger";
import { ThemeToggle } from "./ThemeToggle";
import { useToast } from "./ui/use-toast";

interface AccountWorkspaceMenuProps {
  readonly onClose: () => void;
  readonly variant?: "sidebar" | "header";
}

function AccountWorkspaceMenu({
  onClose,
  variant = "sidebar",
}: AccountWorkspaceMenuProps) {
  const { user, logout } = useIdentity();
  const {
    tenants,
    currentTenant,
    isLoading: isTenantLoading,
    isSwitching,
    switchingTenantId,
    switchTenant,
    setDefaultTenant,
    isSettingDefault,
    settingDefaultTenantId,
  } = useTenantContext();
  const { toast } = useToast();
  const logger = useLogger("AccountWorkspaceMenu");
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const canCopyToken = Boolean(user?.roles?.includes("Administrator"));
  const currentTenantName =
    currentTenant?.displayName ?? "No active organization";
  const hiddenMenuAnimationClass =
    variant === "header"
      ? "-translate-y-1 scale-[0.98] opacity-0"
      : "translate-y-1 scale-[0.98] opacity-0";

  const handleTenantSwitch = async (tenantId: string) => {
    if (isSwitching || tenantId === currentTenant?.tenantId) return;

    try {
      await switchTenant(tenantId);
      onClose();
      toast({
        title: "Organization switched",
        description: "Your workspace context has been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to switch organization",
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleSetDefaultTenant = async (tenantId: string) => {
    if (isSettingDefault) return;

    try {
      await setDefaultTenant(tenantId);
      toast({
        title: "Default organization updated",
        description: "Your default organization preference has been saved.",
      });
    } catch (error) {
      toast({
        title: "Failed to set default organization",
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await logout({ redirectTo: "/" });
  };

  const handleCopyToken = () => {
    const token = identityApi.getToken();
    if (!token) {
      return;
    }

    navigator.clipboard.writeText(`Bearer ${token}`);
    setCopied(true);

    if (copyFeedbackTimeoutRef.current) {
      globalThis.clearTimeout(copyFeedbackTimeoutRef.current);
    }

    copyFeedbackTimeoutRef.current = globalThis.setTimeout(() => {
      setCopied(false);
      copyFeedbackTimeoutRef.current = null;
    }, 2000);
  };

  const runMenuAction = (action: () => void | Promise<void>) => {
    onClose();
    Promise.resolve(action()).catch((error) => {
      logger.UI.error("Account menu action failed", error);
    });
  };

  const handleAccountSettings = () => {
    runMenuAction(() => navigate("/account"));
  };

  const handleSignOutClick = () => {
    runMenuAction(handleSignOut);
  };

  const handleTenantSwitchClick = (tenantId: string) => {
    Promise.resolve(handleTenantSwitch(tenantId)).catch((error) => {
      logger.UI.error("Tenant switch action failed", error);
    });
  };

  const handleSetDefaultTenantClick = (tenantId: string) => {
    Promise.resolve(handleSetDefaultTenant(tenantId)).catch((error) => {
      logger.UI.error("Set default tenant action failed", error);
    });
  };

  useEffect(() => {
    const animationFrame = globalThis.requestAnimationFrame(() => {
      setIsMenuVisible(true);
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.cancelAnimationFrame(animationFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);

      if (copyFeedbackTimeoutRef.current) {
        globalThis.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, [onClose]);

  let tenantMembershipContent: ReactNode;
  if (isTenantLoading) {
    tenantMembershipContent = (
      <div className="space-y-2 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2
            className={cn(
              "h-4 w-4 animate-spin text-muted-foreground",
              variant === "header"
                ? "[animation-duration:900ms]"
                : "[animation-duration:1200ms]",
            )}
          />
          <span className="animate-pulse">Loading tenants...</span>
        </div>
        <div
          className={cn(
            "h-2 rounded bg-muted animate-pulse",
            variant === "header" ? "w-3/4" : "w-2/3",
          )}
        />
        <div
          className={cn(
            "h-2 rounded bg-muted animate-pulse",
            variant === "header" ? "w-2/3" : "w-1/2",
          )}
        />
      </div>
    );
  } else if (tenants.length > 1) {
    tenantMembershipContent = tenants.map((tenant) => {
      const isCurrent = tenant.isCurrentTenant;
      const isItemSwitching = switchingTenantId === tenant.tenantId;
      const isItemSettingDefault = settingDefaultTenantId === tenant.tenantId;
      let statusIndicator = null;

      if (isItemSwitching || isItemSettingDefault) {
        statusIndicator = (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        );
      } else if (isCurrent) {
        statusIndicator = <Check className="h-4 w-4 text-brand-accent" />;
      }

      return (
        <div key={tenant.tenantId} className="px-3 py-2 hover:bg-muted/60">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => handleTenantSwitchClick(tenant.tenantId)}
              disabled={isSwitching || isCurrent}
              className="min-w-0 flex-1 text-left text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="truncate font-medium">{tenant.displayName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{tenant.role}</span>
                {tenant.isDefault && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
            </button>
            <div className="flex items-center gap-2">
              {!tenant.isDefault && (
                <button
                  onClick={() => handleSetDefaultTenantClick(tenant.tenantId)}
                  disabled={isSettingDefault}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
                  title="Set as default organization"
                >
                  {isItemSettingDefault ? "Saving..." : "Set default"}
                </button>
              )}
              {statusIndicator}
            </div>
          </div>
        </div>
      );
    });
  } else if (tenants.length === 0) {
    tenantMembershipContent = (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        No organization memberships found.
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "w-72 rounded-lg border border-border bg-popover py-1.5 text-popover-foreground shadow-lg",
        "transform-gpu transition duration-150 ease-out",
        variant === "header"
          ? "absolute right-0 top-full z-50 mt-2 origin-top-right"
          : "absolute bottom-full left-0 mb-2 origin-bottom-left",
        isMenuVisible
          ? "translate-y-0 scale-100 opacity-100"
          : hiddenMenuAnimationClass,
      )}
    >
      <div className="px-3 py-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Current Account
        </div>
        <div className="truncate text-sm font-medium text-foreground">
          {currentTenantName}
        </div>
      </div>
      <button
        onClick={handleAccountSettings}
        className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60"
      >
        Account Settings
      </button>
      <ThemeToggle variant="menu" />
      {tenants.length > 1 && (
        <>
          <div className="my-1 h-px bg-border" />
          <div className="px-3 py-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Switch Account
            </div>
            <div className="mt-1 max-h-52 overflow-y-auto">
              {tenantMembershipContent}
            </div>
          </div>
        </>
      )}
      <div className="my-1 h-px bg-border" />
      {canCopyToken && (
        <>
          <button
            onClick={handleCopyToken}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60"
            title="Copy Bearer Token"
          >
            <span>Copy Token</span>
            {copied ? (
              <Check className="h-4 w-4 text-brand-accent" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      <a
        href={WHATS_NEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60"
      >
        What's New?
      </a>
      <a
        href={SUPPORT_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted/60"
      >
        Report A Bug
      </a>
      <button
        onClick={handleSignOutClick}
        className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
      >
        Sign out
      </button>
    </div>
  );
}

export default AccountWorkspaceMenu;
