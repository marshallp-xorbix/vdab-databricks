import { ToastAction } from "../components/ui/toast";
import { toast } from "../components/ui/use-toast";
import { ApiError } from "../models";

const AUTH_HELP_MESSAGE =
  "Most issues are resolved by re-authenticating with Databricks";

const isAuthFailure = (error: unknown) =>
  error instanceof ApiError && (error.status === 400 || error.status === 401);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const showAuthFailureToast = (
  error: unknown,
  title: string,
  fallbackDescription: string,
  onAuthenticate?: () => void | Promise<void>
) => {
  if (!isAuthFailure(error)) {
    return false;
  }

  toast({
    title,
    variant: "destructive",
    description: (
      <div className="space-y-1">
        <p>{getErrorMessage(error, fallbackDescription)}</p>
        <p className="text-xs text-destructive">{AUTH_HELP_MESSAGE}</p>
      </div>
    ),
    action: (
      <ToastAction
        altText="Authenticate"
        onClick={() => {
          if (!onAuthenticate) {
            console.warn("No Databricks authentication handler configured.");
            return;
          }

          try {
            const result = onAuthenticate();
            if (result instanceof Promise) {
              result.catch((authError) => {
                console.error("Databricks authentication failed", authError);
              });
            }
          } catch (authError) {
            console.error("Databricks authentication failed", authError);
          }
        }}
        className="border-destructive/30 text-destructive hover:bg-destructive-subtle"
      >
        Authenticate
      </ToastAction>
    ),
  });

  return true;
};
