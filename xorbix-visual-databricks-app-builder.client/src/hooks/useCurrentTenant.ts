import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { Tenant } from "../models";

interface IUseCurrentTenantResult {
  tenant: Tenant | null;
  ownerId: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const CURRENT_TENANT_QUERY_KEY = ["tenant", "current"] as const;

/**
 * Loads the caller's current tenant, exposing the tenant owner id used to
 * surface the owner indicator and gate owner-only actions. Backed by TanStack
 * Query so the value is cached and shared across components.
 *
 * @param enabled When false, no fetch is performed (e.g. outside tenant context).
 */
export function useCurrentTenant(
  enabled: boolean = true,
): IUseCurrentTenantResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CURRENT_TENANT_QUERY_KEY,
    queryFn: async () => new Tenant(await tenantApi.getCurrentTenant()),
    enabled,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: CURRENT_TENANT_QUERY_KEY });
  }, [queryClient]);

  const tenant = useMemo(() => query.data ?? null, [query.data]);

  return {
    tenant,
    ownerId: tenant?.ownerId ?? null,
    isLoading: enabled && query.isLoading,
    refresh,
  };
}
