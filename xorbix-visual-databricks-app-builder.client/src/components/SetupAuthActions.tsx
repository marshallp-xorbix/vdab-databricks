import { Loader2, UserCircle } from "lucide-react";
import { useState } from "react";
import { useIdentity } from "../context/IdentityContext";

/**
 * Sign-out control for the account-setup header. Signs the user out and returns
 * them to the landing page.
 */
function SetupAuthActions() {
  const { logout } = useIdentity();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await logout({ redirectTo: "/" });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      {isSigningOut ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Sign out...
        </>
      ) : (
        <>
          <UserCircle className="h-5 w-5 shrink-0 opacity-90" />
          Sign out
        </>
      )}
    </button>
  );
}

export default SetupAuthActions;
