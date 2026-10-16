import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus } from "lucide-react";
import { ManagementPageHeader } from "../../components/ManagementPageHeader";
import TenantSeatsTable from "../../components/TenantSeatsTable";
import InviteUsersDialog from "../../components/InviteUsersDialog";
import PendingInvitesGrid from "../../components/PendingInvitesGrid";
import RemovedMembersGrid from "../../components/RemovedMembersGrid";
import RestorePriorMemberDialog from "../../components/RestorePriorMemberDialog";
import { Button } from "../../components/ui/button";
import type { ColumnFilterType } from "../../components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "../../components/ui/use-toast";
import { useIdentity } from "../../context/IdentityContext";
import { useUserManagement } from "../../hooks/useUserManagement";
import { useTableSearchParams } from "../../hooks/useTableSearchParams";
import { useSubscription } from "../../hooks/useSubscription";
import { useTeamSeats, seatQueryKeys } from "../../hooks/useTeamSeats";
import { useCurrentTenant } from "../../hooks/useCurrentTenant";
import { useRemoveUserFromSeat } from "../../hooks/useRemoveUserFromSeat";
import { useRemovedMembers } from "../../hooks/useRemovedMembers";
import { useClientConfig } from "../../hooks/useClientConfig";
import { useLogger } from "../../logger/useLogger";
import { billingApi } from "../../providers/BillingApi";
import { tenantApi } from "../../api/TenantApi";
import type { IPriorMemberPrompt, RemovedTenantMember } from "../../models";
import { canManageSeatsAsAdminOrGlobal } from "../../types/tenantRole";
import { isGlobalAdministrator } from "../../utils/roles";
import { buildSeatUserRows } from "../../utils/seatUserRows";
import { parseError } from "../../lib/utils";
import type { SeatUserRow } from "../../types/seatTable";
import {
  ACCOUNT_PAGE_CONTAINER_CLASS,
  ACCOUNT_PAGE_SECTION_CLASS,
} from "./accountPageStyles.ts";

const COLUMN_FILTER_TYPES: Record<string, ColumnFilterType> = {
  user: "text",
  status: "select",
};

const DEFAULT_SORT = [{ id: "seatNumber", desc: false }] as const;

function toPriorMemberPrompt(member: RemovedTenantMember): IPriorMemberPrompt {
  return {
    displayName: member.displayName,
    email: member.email,
    removedOn: member.removedOn,
    priorRole: member.role,
    allowDifferentPerson: false,
    otherTenantsHaveEndedMemberships: false,
  };
}

function SeatManagement() {
  const navigate = useNavigate();
  const logger = useLogger("SeatManagement");
  const { membershipReinstatementDays } = useClientConfig();
  const { user: identityUser, isLoaded } = useIdentity();
  const { users, loadUsers } = useUserManagement(true);
  const { removeUserFromSeat, isRemoving: removeUserSubmitting } =
    useRemoveUserFromSeat(seatQueryKeys.tenantContext, loadUsers);
  const {
    canUseSeatManagement,
    loading: subscriptionLoading,
    error: subscriptionError,
  } = useSubscription();
  const {
    seats,
    invites,
    seatsLoading: loading,
    invitesLoading,
    seatsError: error,
    invitesError,
    teamSeatCount,
    teamSeatsFilled,
    openSeatCount,
    pendingCancellationCount,
    refreshSeats,
    refreshInvites,
  } = useTeamSeats({ mode: "tenantContext" });

  const {
    members: removedMembers,
    loading: removedMembersLoading,
    error: removedMembersError,
    refresh: refreshRemovedMembers,
  } = useRemovedMembers(isLoaded);

  const { ownerId, tenant, refresh: refreshOwner } = useCurrentTenant(isLoaded);

  const isGlobalAdmin = isGlobalAdministrator(identityUser);
  const isCurrentUserOwner = !!ownerId && ownerId === identityUser?.userId;
  // The tenant owner or a global administrator may transfer ownership; the owner
  // row itself stays protected for every viewer.
  const canTransferOwnership = isCurrentUserOwner || isGlobalAdmin;

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [restoreMemberTarget, setRestoreMemberTarget] =
    useState<RemovedTenantMember | null>(null);
  const [removeUserTarget, setRemoveUserTarget] = useState<SeatUserRow | null>(
    null,
  );
  const [removeSeatTarget, setRemoveSeatTarget] = useState<SeatUserRow | null>(
    null,
  );
  const [makeOwnerTarget, setMakeOwnerTarget] = useState<SeatUserRow | null>(
    null,
  );
  const [removeSeatSubmitting, setRemoveSeatSubmitting] = useState(false);
  const [makeOwnerSubmitting, setMakeOwnerSubmitting] = useState(false);

  const {
    globalFilter,
    sorting,
    pagination,
    columnFilters,
    onGlobalFilterChange,
    onSortingChange,
    onPaginationChange,
    onColumnFiltersChange,
  } = useTableSearchParams({
    defaultSort: [...DEFAULT_SORT],
    defaultPageSize: 10,
    columnFilterTypes: COLUMN_FILTER_TYPES,
  });

  // Gate by tenant Admin role or global Administrator. Redirect users who can't manage seats away.
  useEffect(() => {
    if (!isLoaded) return;
    if (
      !canManageSeatsAsAdminOrGlobal(identityUser?.tenantRole, isGlobalAdmin)
    ) {
      navigate("/account", { replace: true });
    }
  }, [identityUser, isGlobalAdmin, isLoaded, navigate]);

  // Surface seat/invite load errors via the existing toast UX.
  useEffect(() => {
    if (invitesError) {
      logger.UI.error("Failed to load invites:", invitesError);
      toast({
        title: "Failed to load pending invites",
        variant: "destructive",
      });
    }
  }, [invitesError, logger]);

  useEffect(() => {
    if (error) {
      logger.UI.error("Failed to load seats:", error);
    }
  }, [error, logger]);

  // Once tier is known, redirect tenants that cannot manage seats.
  useEffect(() => {
    if (subscriptionLoading) return;
    // Treat a failed subscription lookup as "cannot manage seats" (matches prior behavior).
    if (subscriptionError !== null) {
      navigate("/account", { replace: true });
      return;
    }
    if (!canUseSeatManagement) {
      navigate("/account", { replace: true });
    }
  }, [subscriptionLoading, subscriptionError, canUseSeatManagement, navigate]);

  const handleViewUser = useCallback(
    (userId: string) => {
      navigate(`/account/seats/users/${userId}`);
    },
    [navigate],
  );

  const handleRemoveUser = useCallback((row: SeatUserRow) => {
    setRemoveUserTarget(row);
  }, []);

  const handleRemoveSeat = useCallback((row: SeatUserRow) => {
    setRemoveSeatTarget(row);
  }, []);

  const handleMakeOwner = useCallback((row: SeatUserRow) => {
    setMakeOwnerTarget(row);
  }, []);

  const activeTenantId = identityUser?.tenantId;
  const rows = useMemo<SeatUserRow[]>(
    () =>
      buildSeatUserRows({
        seats,
        users,
        tenantId: activeTenantId,
        ownerId,
        excludeInactiveMembers: true,
      }),
    [seats, users, activeTenantId, ownerId],
  );

  const summary = useMemo(
    () => ({
      total: teamSeatCount,
      occupied: teamSeatsFilled,
      open: openSeatCount,
      pending: pendingCancellationCount,
    }),
    [teamSeatCount, teamSeatsFilled, openSeatCount, pendingCancellationCount],
  );

  // Re-load users when mounting so seat joins are fresh.
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const removeUserTargetName =
    removeUserTarget?.user?.fullName ??
    removeUserTarget?.user?.email ??
    removeUserTarget?.seat.userDisplayName ??
    removeUserTarget?.seat.userEmail ??
    "this user";

  const removeSeatTargetName =
    removeSeatTarget?.user?.fullName ??
    removeSeatTarget?.user?.email ??
    removeSeatTarget?.seat.userDisplayName ??
    removeSeatTarget?.seat.userEmail ??
    null;

  const makeOwnerTargetName =
    makeOwnerTarget?.user?.fullName ??
    makeOwnerTarget?.user?.email ??
    makeOwnerTarget?.seat.userDisplayName ??
    makeOwnerTarget?.seat.userEmail ??
    "this user";

  const removeSeatPeriodEnd = (() => {
    const end = removeSeatTarget?.seat.seatEndDate;
    if (end instanceof Date && !Number.isNaN(end.getTime())) {
      return end.toLocaleDateString();
    }
    return "the end of the current billing period";
  })();

  const confirmRemoveUser = useCallback(async () => {
    if (!removeUserTarget) return;
    const seatId = removeUserTarget.seat.seatId;
    const targetName =
      removeUserTarget.user?.fullName ??
      removeUserTarget.user?.email ??
      removeUserTarget.seat.userDisplayName ??
      removeUserTarget.seat.userEmail ??
      "the user";
    try {
      await removeUserFromSeat(seatId);
      toast({
        title: "User removed",
        description: `${targetName} was removed from their seat.`,
      });
      setRemoveUserTarget(null);
    } catch (err) {
      logger.UI.error("Failed to remove user from seat:", err);
      toast({
        title: "Failed to remove user",
        description: parseError(err).message || "Please try again shortly.",
        variant: "destructive",
      });
    }
  }, [removeUserTarget, removeUserFromSeat, logger]);

  const confirmRemoveSeat = useCallback(async () => {
    if (!removeSeatTarget) return;
    const seatId = removeSeatTarget.seat.seatId;
    try {
      setRemoveSeatSubmitting(true);
      await billingApi.removeSeat(seatId);
      toast({
        title: "Seat scheduled for cancellation",
        description: `Seat #${removeSeatTarget.seatNumber} will be removed at period end.`,
      });
      setRemoveSeatTarget(null);
      await refreshSeats();
    } catch (err) {
      logger.UI.error("Failed to schedule seat cancellation:", err);
      toast({
        title: "Failed to schedule seat cancellation",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setRemoveSeatSubmitting(false);
    }
  }, [removeSeatTarget, refreshSeats, logger]);

  const confirmMakeOwner = useCallback(async () => {
    if (!makeOwnerTarget?.user) return;
    const targetUserId = makeOwnerTarget.user.id;
    try {
      setMakeOwnerSubmitting(true);
      await tenantApi.transferOwnership(targetUserId);
      toast({
        title: "Ownership transferred",
        description: `${makeOwnerTargetName} is now the tenant owner.`,
      });
      setMakeOwnerTarget(null);
      await Promise.all([refreshSeats(), loadUsers(), refreshOwner()]);
    } catch (err) {
      logger.UI.error("Failed to transfer ownership:", err);
      toast({
        title: "Failed to transfer ownership",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setMakeOwnerSubmitting(false);
    }
  }, [
    makeOwnerTarget,
    makeOwnerTargetName,
    refreshSeats,
    loadUsers,
    refreshOwner,
    logger,
  ]);

  const description = `${summary.total} ${summary.total === 1 ? "Seat" : "Seats"} · ${summary.open} Open · ${summary.pending} Pending Cancellation`;

  return (
    <section className={ACCOUNT_PAGE_SECTION_CLASS}>
      <div className={ACCOUNT_PAGE_CONTAINER_CLASS}>
        <ManagementPageHeader
          title="Seats & Users"
          description={description}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{summary.occupied} assigned</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Invite users
              </Button>
            </div>
          }
        />

        {error && (
          <div className="rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
            Failed to load seats. Please try again.
          </div>
        )}

        <div id="pending-invites">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Pending invites
          </h3>
          {invitesLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : (
            <PendingInvitesGrid invites={invites} onChanged={refreshInvites} />
          )}
        </div>

        <div id="removed-members">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Removed members
          </h3>
          {removedMembersError && (
            <div className="mb-2 rounded-md bg-destructive-subtle px-4 py-2 text-sm text-destructive-foreground">
              {removedMembersError}
            </div>
          )}
          {removedMembersLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : (
            <RemovedMembersGrid
              members={removedMembers}
              onRestore={setRestoreMemberTarget}
            />
          )}
        </div>

        <div id="seat-table">
          <TenantSeatsTable
            rows={rows}
            loading={loading}
            globalFilter={globalFilter}
            onGlobalFilterChange={onGlobalFilterChange}
            sorting={sorting}
            onSortingChange={onSortingChange}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            columnFilters={columnFilters}
            onColumnFiltersChange={onColumnFiltersChange}
            onViewUser={handleViewUser}
            onRemoveUser={handleRemoveUser}
            onRemoveSeat={handleRemoveSeat}
            showSeatManagementActions
            ownerId={ownerId}
            canTransferOwnership={canTransferOwnership}
            onMakeOwner={handleMakeOwner}
            onRowClick={(row) => {
              if (row.user) {
                handleViewUser(row.user.id);
              }
            }}
          />
        </div>
      </div>

      <InviteUsersDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        availableSeats={summary.open}
        onInvitesCreated={() => {
          void refreshInvites();
          void refreshRemovedMembers();
          void refreshSeats();
          void loadUsers();
        }}
      />

      <RestorePriorMemberDialog
        open={restoreMemberTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreMemberTarget(null);
        }}
        prompts={
          restoreMemberTarget
            ? [toPriorMemberPrompt(restoreMemberTarget)]
            : []
        }
        onInvitesCreated={() => {
          void refreshInvites();
          void refreshRemovedMembers();
          void refreshSeats();
          void loadUsers();
        }}
      />

      <Dialog
        open={removeUserTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeUserSubmitting) setRemoveUserTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user from workspace?</DialogTitle>
            <DialogDescription>
              Remove {removeUserTargetName}
              {tenant?.displayName ? ` from ${tenant.displayName}` : ""}? They
              lose access to this workspace immediately and their seat is
              released. Their VDAB account and any other organizations are
              unaffected. You can restore their membership for{" "}
              {membershipReinstatementDays} days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveUserTarget(null)}
              disabled={removeUserSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveUser}
              disabled={removeUserSubmitting}
            >
              {removeUserSubmitting ? "Removing..." : "Remove user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeSeatTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeSeatSubmitting) setRemoveSeatTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this seat at period end?</DialogTitle>
            <DialogDescription>
              {removeSeatTargetName
                ? `${removeSeatTargetName} keeps access until ${removeSeatPeriodEnd}, at which point the seat is removed and billing is reduced.`
                : `The seat will be removed at ${removeSeatPeriodEnd} and billing will be reduced accordingly.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveSeatTarget(null)}
              disabled={removeSeatSubmitting}
            >
              Keep seat
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveSeat}
              disabled={removeSeatSubmitting}
            >
              {removeSeatSubmitting ? "Scheduling..." : "Schedule removal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={makeOwnerTarget !== null}
        onOpenChange={(open) => {
          if (!open && !makeOwnerSubmitting) setMakeOwnerTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer tenant ownership?</DialogTitle>
            <DialogDescription>
              {makeOwnerTargetName} will become the tenant owner and be promoted
              to Admin if they aren&apos;t already.{" "}
              {isCurrentUserOwner
                ? "You will remain a member with your current role but will no longer be the owner. Only the new owner can transfer ownership again."
                : "The current owner keeps their role but will no longer be the owner."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMakeOwnerTarget(null)}
              disabled={makeOwnerSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={confirmMakeOwner} disabled={makeOwnerSubmitting}>
              {makeOwnerSubmitting ? "Transferring..." : "Transfer ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default SeatManagement;
