import type { ReactNode } from "react";
import { BACKGROUND_URL } from "../constants/authBranding";
import { useTheme } from "../context/ThemeContext";
import { BrandedTopBar } from "./BrandedTopBar";

interface AuthPageShellProps {
  readonly children: ReactNode;
  readonly variant?: "guest" | "setup" | "authenticated";
}

/**
 * Auth flows: branded top bar + develop site background (light) or flat ground (dark).
 */
export function AuthPageShell({
  children,
  variant = "guest",
}: AuthPageShellProps) {
  const { theme } = useTheme();
  const useSiteBackground = theme === "light";

  return (
    <div className="flex min-h-screen w-full flex-1 flex-col text-foreground [[data-public-auth-layout]_&]:min-h-0">
      <BrandedTopBar variant={variant} />
      <div
        className={
          useSiteBackground
            ? "relative flex min-h-0 w-full flex-1 flex-col bg-cover bg-center bg-no-repeat"
            : "relative flex min-h-0 w-full flex-1 flex-col bg-background"
        }
        style={
          useSiteBackground
            ? {
                backgroundImage: `url(${BACKGROUND_URL})`,
                backgroundAttachment: "fixed",
              }
            : undefined
        }
      >
        <div className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
