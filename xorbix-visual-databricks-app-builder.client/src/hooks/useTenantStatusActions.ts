import { useMutation } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { toast } from "../components/ui/use-toast";
import { parseError } from "../lib/utils";
import type { Tenant } from "../models";

export interface UseTenantStatusActionsOptions {
  /**
   * Invoked after a tenant is successfully deactivated or reactivated. Use this
   * to refetch tenant data and/or close any confirmation dialog.
   */
  onChanged?: (tenant: Tenant) => Promise<void> | void;
}

export interface UseTenantStatusActionsResult {
  deactivate: (tenant: Tenant) => void;
  reactivate: (tenant: Tenant) => void;
  isDeactivating: boolean;
  isReactivating: boolean;
  isPending: boolean;
}

/**
 * Shared mutations for deactivating and reactivating a tenant. Handles the
 * Stripe-aware toasts and surfaces a single `onChanged` callback so callers can
 * refetch their tenant data and dismiss confirmation dialogs.
 */
export function useTenantStatusActions(
  options: UseTenantStatusActionsOptions = {},
): UseTenantStatusActionsResult {
  const { onChanged } = options;

  const deactivateMutation = useMutation({
    mutationFn: (tenant: Tenant) => tenantApi.deactivateTenant(tenant.tenantId),
    onSuccess: async (_data, tenant) => {
      toast({
        title: "Tenant deactivated",
        description:
          "The tenant has been deactivated. Subscription will cancel at period end.",
      });
      await onChanged?.(tenant);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to deactivate tenant",
        description: parseError(error).message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (tenant: Tenant) => tenantApi.reactivateTenant(tenant.tenantId),
    onSuccess: async (_data, tenant) => {
      toast({
        title: "Tenant reactivated",
        description: "The tenant is active again.",
      });
      await onChanged?.(tenant);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to reactivate tenant",
        description: parseError(error).message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    deactivate: deactivateMutation.mutate,
    reactivate: reactivateMutation.mutate,
    isDeactivating: deactivateMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    isPending: deactivateMutation.isPending || reactivateMutation.isPending,
  };
}
