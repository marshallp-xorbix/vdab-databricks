import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantApi,
  type IPaginatedTenantsResponse,
  type IUpdateTenantRequest,
} from "../api/TenantApi";
import { Tenant, type ICreateTenantRequest } from "../models";

const TENANT_QUERY_PAGE_SIZE = 100;

export const tenantManagementKeys = {
  all: ["tenantManagement"] as const,
  list: () => [...tenantManagementKeys.all, "list"] as const,
};

/** Query keys for tenant detail / usage (admin tenant pages). */
export const tenantDetailKeys = {
  all: ["tenant"] as const,
  detail: (id: string) => [...tenantDetailKeys.all, id] as const,
  usage: (id: string) => [...tenantDetailKeys.detail(id), "usage"] as const,
  /** Global user list loaded by the tenant detail page; filter by membership to get members. */
  users: (id: string) => [...tenantDetailKeys.detail(id), "users"] as const,
};

async function fetchAllTenants(): Promise<Tenant[]> {
  const allTenants: Tenant[] = [];
  let skip = 0;
  let totalCount = 0;

  do {
    const response: IPaginatedTenantsResponse = await tenantApi.getAllTenants(
      skip,
      TENANT_QUERY_PAGE_SIZE,
    );

    const mappedTenants = response.tenants.map((tenant) => new Tenant(tenant));

    allTenants.push(...mappedTenants);
    totalCount = response.totalCount;
    skip += response.tenants.length;

    // Guard against an unexpected empty page from the API.
    if (response.tenants.length === 0) {
      break;
    }
  } while (skip < totalCount);

  return allTenants;
}

export function useTenantManagement() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: tenantManagementKeys.list(),
    queryFn: fetchAllTenants,
    staleTime: 60 * 1000,
  });

  const updateTenantMutation = useMutation({
    mutationFn: ({
      tenantId,
      request,
    }: {
      tenantId: string;
      request: IUpdateTenantRequest;
    }) => tenantApi.updateTenantById(tenantId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: tenantManagementKeys.list(),
      });
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: (request: ICreateTenantRequest) =>
      tenantApi.createTenant(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: tenantManagementKeys.list(),
      });
    },
  });

  return {
    tenants: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateTenant: updateTenantMutation.mutateAsync,
    isUpdatingTenant: updateTenantMutation.isPending,
    createTenant: createTenantMutation.mutateAsync,
    isCreatingTenant: createTenantMutation.isPending,
  };
}
