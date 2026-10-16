import { Seat, type ApplicationUser } from "../models";
import type { SeatUserRow } from "../types/seatTable";

/** Membership status for a member removed from a tenant. */
const ENDED_MEMBERSHIP_STATUS = "Ended";

/** Membership status for a member suspended in a tenant; their seat is released. */
const SUSPENDED_MEMBERSHIP_STATUS = "Suspended";

/** Seat status applied to rows that stand in for a member without a stored seat. */
const SYNTHETIC_SEAT_STATUS = "Active";

export interface IBuildSeatUserRowsInput {
  /** Stored subscription seats for the tenant. */
  seats: Seat[];
  /** Users available for joining seat occupants and finding unseated members. */
  users: ApplicationUser[];
  /** The tenant whose members should appear; members of other tenants are ignored. */
  tenantId: string | null | undefined;
  /** The tenant owner, used as a fallback row when the tenant has no seats or members. */
  ownerId?: string | null;
  /** When true, unseated members who are suspended in the tenant or whose account is deactivated get no synthetic row. */
  excludeInactiveMembers?: boolean;
}

/**
 * Returns true when the user holds a current (not ended) membership in the tenant.
 *
 * @param user - The user whose memberships are checked.
 * @param tenantId - The tenant to match.
 */
export function isCurrentTenantMember(
  user: ApplicationUser,
  tenantId: string,
): boolean {
  return (user.tenantMembershipsSummary ?? []).some(
    (membership) =>
      membership.tenantId === tenantId &&
      membership.status !== ENDED_MEMBERSHIP_STATUS,
  );
}

function isActiveTenantMember(user: ApplicationUser, tenantId: string): boolean {
  return (
    user.isActive &&
    (user.tenantMembershipsSummary ?? []).some(
      (membership) =>
        membership.tenantId === tenantId &&
        membership.status !== ENDED_MEMBERSHIP_STATUS &&
        membership.status !== SUSPENDED_MEMBERSHIP_STATUS,
    )
  );
}

function createSyntheticSeat(
  seatId: string,
  userId: string,
  user: ApplicationUser | undefined,
  isBundled: boolean,
): Seat {
  return new Seat({
    seatId,
    userId,
    userEmail: user?.email,
    userDisplayName: user ? user.fullName || user.email : undefined,
    status: SYNTHETIC_SEAT_STATUS,
    isBundled,
    seatStartDate: new Date(),
  });
}

function compareSeats(left: Seat, right: Seat): number {
  if (!!left.userId !== !!right.userId) {
    return left.userId ? -1 : 1;
  }

  const leftTime =
    left.seatStartDate instanceof Date ? left.seatStartDate.getTime() : 0;
  const rightTime =
    right.seatStartDate instanceof Date ? right.seatStartDate.getTime() : 0;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.seatId.localeCompare(right.seatId);
}

/**
 * Builds seat table rows from stored seats plus every current tenant member who is
 * not occupying a seat, so over-capacity and unseated members stay visible. Rows
 * without a stored seat are flagged with `isSyntheticSeat`.
 *
 * @param input - Seats, users, and tenant context for the table.
 * @returns Rows ordered with occupied seats first, then by seat start date.
 */
export function buildSeatUserRows({
  seats,
  users,
  tenantId,
  ownerId,
  excludeInactiveMembers = false,
}: Readonly<IBuildSeatUserRowsInput>): SeatUserRow[] {
  const userById = new Map<string, ApplicationUser>(
    users.map((user) => [user.id, user]),
  );
  const syntheticSeatIds = new Set<string>();
  const sourceSeats: Seat[] = [...seats];
  const seatedUserIds = new Set(
    seats
      .map((seat) => seat.userId)
      .filter((userId): userId is string => Boolean(userId)),
  );

  const isListedMember = excludeInactiveMembers
    ? isActiveTenantMember
    : isCurrentTenantMember;
  const tenantMembers = tenantId
    ? [...userById.values()].filter((user) => isListedMember(user, tenantId))
    : [];

  for (const member of tenantMembers) {
    if (seatedUserIds.has(member.id)) {
      continue;
    }

    const seat = createSyntheticSeat(
      `member-${member.id}`,
      member.id,
      member,
      false,
    );
    sourceSeats.push(seat);
    syntheticSeatIds.add(seat.seatId);
    seatedUserIds.add(member.id);
  }

  if (sourceSeats.length === 0 && ownerId) {
    const seat = createSyntheticSeat(
      `owner-${ownerId}`,
      ownerId,
      userById.get(ownerId),
      true,
    );
    sourceSeats.push(seat);
    syntheticSeatIds.add(seat.seatId);
  }

  return [...sourceSeats].sort(compareSeats).map((seat, index) => ({
    seat,
    user: seat.userId ? userById.get(seat.userId) : undefined,
    seatNumber: index + 1,
    isSyntheticSeat: syntheticSeatIds.has(seat.seatId),
  }));
}
