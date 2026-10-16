import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { RemovedTenantMember } from "../models";
import { parseError } from "../lib/utils";

export const removedMembersQueryKey = ["tenantMembers", "removed"] as const;

/**
 * Loads soft-deleted tenant memberships for the current tenant.
 */
export function useRemovedMembers(enabled: boolean = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: removedMembersQueryKey,
    enabled,
    queryFn: async () => {
      const data = await tenantApi.getRemovedMembers();
      return data.map((row) => new RemovedTenantMember(row));
    },
  });

  return {
    members: query.data ?? [],
    loading: query.isLoading,
    error: query.error
      ? parseError(query.error).message || "Failed to load removed members."
      : null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: removedMembersQueryKey });
    },
  };
}
