import { useMutation } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { parseError } from "../lib/utils";
import { toast } from "../components/ui/use-toast";
import { useLogger } from "../logger/useLogger";
import { useTenantContext } from "./useTenantContext";

/**
 * Creates a personal Incomplete workspace for a Detached account, then switches into it.
 */
export function useCreatePersonalWorkspace() {
  const logger = useLogger("useCreatePersonalWorkspace");
  const { switchTenant, refreshTenants } = useTenantContext();

  const mutation = useMutation({
    mutationFn: () => tenantApi.createPersonalWorkspace(),
    onSuccess: async (tenant) => {
      toast({
        title: "Workspace created",
        description: "Continue with billing setup for your new workspace.",
      });
      logger.UI.log("Created personal workspace", { tenantId: tenant.tenantId });
      await refreshTenants();
      await switchTenant(tenant.tenantId);
    },
    onError: (err) => {
      logger.UI.error("Failed to create personal workspace:", err);
      toast({
        title: "Could not create workspace",
        description: parseError(err).message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    createPersonalWorkspace: mutation.mutate,
    isCreating: mutation.isPending,
  };
}
