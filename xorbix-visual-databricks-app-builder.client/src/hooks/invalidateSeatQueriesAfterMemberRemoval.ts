import type { QueryClient } from "@tanstack/react-query";
import { seatQueryKeys } from "./useTeamSeats";

/**
 * Invalidates seat and invite queries after a member is removed via the
 * tenant members API (e.g. from UserDetail).
 */
export async function invalidateSeatQueriesAfterMemberRemoval(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: seatQueryKeys.tenantContext }),
    queryClient.invalidateQueries({ queryKey: seatQueryKeys.pendingInvites }),
  ]);
}
