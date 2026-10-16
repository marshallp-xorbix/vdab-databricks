import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "../api/TenantApi";
import { auditLogKeys } from "./useAuditLogsQuery";
import { invalidateSeatQueriesAfterMemberRemoval } from "./invalidateSeatQueriesAfterMemberRemoval";
import { removedMembersQueryKey } from "./useRemovedMembers";
import { seatQueryKeys } from "./useTeamSeats";
import { tenantDetailKeys, tenantManagementKeys } from "./useTenantManagement";

/**
 * Global-administrator mutation that removes a member from an explicitly
 * specified tenant, then refreshes that tenant's admin-scoped seats, user
 * list, and usage stats, plus the tenant list, audit logs, and removed-member
 * and tenant-context seat caches — including after a failure, since the
 * server may have partially applied the change.
 *
 * @param tenantId - The tenant the member is removed from.
 */
export function useRemoveTenantMember(tenantId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (userId: string) =>
      tenantApi.removeMemberFromTenant(tenantId, userId),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: seatQueryKeys.admin(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: tenantDetailKeys.users(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: tenantDetailKeys.usage(tenantId),
        }),
        queryClient.invalidateQueries({
          queryKey: tenantManagementKeys.list(),
        }),
        queryClient.invalidateQueries({ queryKey: auditLogKeys.all }),
        queryClient.invalidateQueries({ queryKey: removedMembersQueryKey }),
        // Covers an admin whose active tenant is the one being edited.
        invalidateSeatQueriesAfterMemberRemoval(queryClient),
      ]);
    },
  });

  return {
    removeTenantMember: mutation.mutateAsync,
    isRemoving: mutation.isPending,
  };
}
