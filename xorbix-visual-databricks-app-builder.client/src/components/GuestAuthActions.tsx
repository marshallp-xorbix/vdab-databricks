import { UserCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/**
 * Public auth call-to-action for the guest header. Shows "Sign up" while on the
 * login route and "Log In" everywhere else.
 */
function GuestAuthActions() {
  const { pathname } = useLocation();
  const onLogin = pathname === "/login";

  if (onLogin) {
    return (
      <Link
        to="/signup"
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
      >
        <UserCircle className="h-5 w-5 shrink-0 opacity-90" />
        Sign up
      </Link>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
    >
      <UserCircle className="h-5 w-5 shrink-0 opacity-90" />
      Log In
    </Link>
  );
}

export default GuestAuthActions;
