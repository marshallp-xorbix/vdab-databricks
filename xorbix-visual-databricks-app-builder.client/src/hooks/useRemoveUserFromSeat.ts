import { useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../providers/BillingApi";
import type { Seat } from "../models";
import { seatQueryKeys } from "./useTeamSeats";
import { removedMembersQueryKey } from "./useRemovedMembers";

/**
 * Mutation that removes a user from a seat and always refreshes seats, invites,
 * removed members, and tenant users — including when the API reports the seat
 * was already empty (partial prior success).
 *
 * @param seatsQueryKey - TanStack Query key for the seats list to update/invalidate
 *   (tenant-context or admin-scoped). Defaults to {@link seatQueryKeys.tenantContext}.
 * @param onUsersRefresh - Optional callback to refresh the tenant user list.
 */
export function useRemoveUserFromSeat(
  seatsQueryKey: readonly unknown[] = seatQueryKeys.tenantContext,
  onUsersRefresh?: () => Promise<void>,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (seatId: string) => billingApi.removeUserFromSeat(seatId),
    onSuccess: (updatedSeat: Seat) => {
      queryClient.setQueryData<Seat[]>(seatsQueryKey, (previous) => {
        if (!previous) return previous;
        return previous.map((seat) =>
          seat.seatId === updatedSeat.seatId ? updatedSeat : seat,
        );
      });
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: seatsQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: seatQueryKeys.pendingInvites,
        }),
        queryClient.invalidateQueries({
          queryKey: removedMembersQueryKey,
        }),
        onUsersRefresh?.(),
      ]);
    },
  });

  return {
    removeUserFromSeat: mutation.mutateAsync,
    isRemoving: mutation.isPending,
  };
}
