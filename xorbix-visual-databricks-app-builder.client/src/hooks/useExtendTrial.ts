import { useMutation } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { toast } from "../components/ui/use-toast";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Please try again.";
}

interface IUseExtendTrialOptions {
  tenantId: string | undefined;
  onExtended: () => Promise<unknown> | void;
}

/**
 * Provides a mutation for extending a tenant's trial end date (global-admin action),
 * with success/error toasts and a caller-supplied refetch on success.
 */
export function useExtendTrial({
  tenantId,
  onExtended,
}: IUseExtendTrialOptions) {
  const mutation = useMutation({
    mutationFn: async (newTrialEndDate: Date) => {
      await tenantApi.extendTrial(tenantId ?? "", newTrialEndDate);
    },
    onSuccess: async () => {
      toast({
        title: "Trial extended",
        description: "The trial end date was updated successfully.",
      });
      await onExtended();
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to extend trial",
        description: describeError(error),
        variant: "destructive",
      });
    },
  });

  return {
    extendTrial: mutation.mutateAsync,
    isExtending: mutation.isPending,
  };
}
