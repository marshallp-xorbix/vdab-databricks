import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantInviteApi } from "../api/TenantInviteApi";
import { billingApi } from "../providers/BillingApi";
import { Seat, TenantInvite } from "../models";

/**
 * Query-key factory for seat and pending-invite caches.
 * Owned by {@link useTeamSeats}; imported by mutations that invalidate these keys.
 */
export const seatQueryKeys = {
  tenantContext: ["seats", "tenantContext"] as const,
  pendingInvites: ["tenantInvites", "pending"] as const,
  admin: (tenantId: string) => ["seats", "admin", tenantId] as const,
};

/**
 * Discriminated input for {@link useTeamSeats}.
 *
 * - `disabled` — no fetches; all values reset to empty/zero. Used for
 *   non-team tenants or when the caller is still resolving preconditions.
 * - `tenantContext` — loads seats and pending invites for the caller's
 *   authenticated tenant context. Used by the account dashboard and the
 *   seat-management page.
 * - `admin` — Global Administrator path. Loads seats for the specified
 *   tenant via the admin-scoped endpoint. Pending invites are not loaded
 *   because that API is tenant-context only.
 */
export type UseTeamSeatsOptions =
  | { mode: "disabled" }
  | { mode: "tenantContext" }
  | { mode: "admin"; tenantId: string };

interface IUseTeamSeatsResult {
  seats: Seat[];
  invites: TenantInvite[];
  seatsLoading: boolean;
  invitesLoading: boolean;
  seatsError: string | null;
  invitesError: string | null;
  teamSeatCount: number;
  teamSeatsFilled: number;
  openSeatCount: number;
  pendingCancellationCount: number;
  pendingInviteCount: number;
  refreshSeats: () => Promise<void>;
  refreshInvites: () => Promise<void>;
}

function toErrorMessage(error: unknown, fallback: string): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return fallback;
}

/**
 * Loads tenant seat assignments and (for tenant-context callers) pending
 * tenant invites, exposing derived counts used by the account dashboard,
 * the seat-management page, and the admin tenant-detail view.
 *
 * Backed by TanStack Query so callers benefit from caching, deduplication,
 * and shared refetch behavior across components.
 */
export function useTeamSeats(
  options: UseTeamSeatsOptions,
): IUseTeamSeatsResult {
  const queryClient = useQueryClient();

  const { mode } = options;
  const adminTenantId = options.mode === "admin" ? options.tenantId : null;

  const seatsQueryKey = useMemo(() => {
    if (mode === "admin" && adminTenantId) {
      return seatQueryKeys.admin(adminTenantId);
    }
    return seatQueryKeys.tenantContext;
  }, [mode, adminTenantId]);

  const invitesQueryKey = useMemo(() => seatQueryKeys.pendingInvites, []);

  const seatsQuery = useQuery({
    queryKey: seatsQueryKey,
    queryFn: async () => {
      if (mode === "admin" && adminTenantId) {
        return billingApi.getSeatsForTenant(adminTenantId);
      }
      return billingApi.getSeats();
    },
    enabled:
      mode === "tenantContext" || (mode === "admin" && !!adminTenantId),
  });

  const invitesQuery = useQuery({
    queryKey: invitesQueryKey,
    queryFn: async () => {
      const list = await tenantInviteApi.listPending();
      return list.map((i) => new TenantInvite(i));
    },
    enabled: mode === "tenantContext",
  });

  const refreshSeats = useCallback(async () => {
    if (mode === "disabled") return;
    await queryClient.invalidateQueries({ queryKey: seatsQueryKey });
  }, [mode, queryClient, seatsQueryKey]);

  const refreshInvites = useCallback(async () => {
    if (mode !== "tenantContext") return;
    await queryClient.invalidateQueries({ queryKey: invitesQueryKey });
  }, [mode, queryClient, invitesQueryKey]);

  const seats = useMemo(() => seatsQuery.data ?? [], [seatsQuery.data]);
  const invites = useMemo(
    () => invitesQuery.data ?? [],
    [invitesQuery.data],
  );

  const seatsLoading = mode !== "disabled" && seatsQuery.isLoading;
  const invitesLoading =
    mode === "tenantContext" && invitesQuery.isLoading;

  const seatsError = useMemo(() => {
    if (mode === "disabled") return null;
    return toErrorMessage(seatsQuery.error, "Failed to load seats.");
  }, [mode, seatsQuery.error]);

  const invitesError = useMemo(() => {
    if (mode !== "tenantContext") return null;
    return toErrorMessage(
      invitesQuery.error,
      "Failed to load pending invites.",
    );
  }, [mode, invitesQuery.error]);

  const teamSeatCount = seats.length;
  const teamSeatsFilled = useMemo(
    () => seats.filter((seat) => !!seat.userId).length,
    [seats],
  );
  const openSeatCount = useMemo(
    () => Math.max(teamSeatCount - teamSeatsFilled, 0),
    [teamSeatCount, teamSeatsFilled],
  );
  const pendingCancellationCount = useMemo(
    () => seats.filter((seat) => seat.status === "PendingCancellation").length,
    [seats],
  );
  const pendingInviteCount = invites.length;

  return {
    seats,
    invites,
    seatsLoading,
    invitesLoading,
    seatsError,
    invitesError,
    teamSeatCount,
    teamSeatsFilled,
    openSeatCount,
    pendingCancellationCount,
    pendingInviteCount,
    refreshSeats,
    refreshInvites,
  };
}
