import { Link } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useCreatePersonalWorkspace } from "../hooks/useCreatePersonalWorkspace";

/**
 * Detached / no-Active-membership empty state: account is fine; access is membership-based.
 * CTAs: create a personal workspace, or accept an invite.
 */
export default function NoActiveWorkspaceBanner() {
  const { createPersonalWorkspace, isCreating } = useCreatePersonalWorkspace();

  return (
    <div
      role="region"
      aria-label="No active workspace"
      className="border-b border-warning/40 bg-warning-subtle px-4 py-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-warning-foreground">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium">Your account has no active workspace</p>
            <p className="text-warning-foreground/90">
              Your account is fine — access to apps and data is through workspace
              membership. Create your own workspace, or accept an invite from a
              teammate. If access was suspended, contact your administrator.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:pt-0.5">
          <Button
            type="button"
            size="sm"
            disabled={isCreating}
            onClick={() => {
              void createPersonalWorkspace();
            }}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              "Create a workspace"
            )}
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/accept-invite">Accept an invite</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
