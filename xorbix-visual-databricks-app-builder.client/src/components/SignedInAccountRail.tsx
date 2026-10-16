import { useState } from "react";
import { useIdentity } from "../context/IdentityContext";
import { useTenantContext } from "../hooks/useTenantContext";
import AccountSummaryButton from "./AccountSummaryButton";
import AccountWorkspaceMenu from "./AccountWorkspaceMenu";

/**
 * Signed-in account control on the right of the app header: account summary
 * button and the workspace/profile menu it toggles (Appearance lives in the menu).
 */
function SignedInAccountRail() {
  const { user } = useIdentity();
  const { currentTenant } = useTenantContext();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  if (!user) {
    return null;
  }

  return (
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
  );
}

export default SignedInAccountRail;
