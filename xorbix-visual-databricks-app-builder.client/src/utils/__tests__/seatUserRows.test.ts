import { describe, expect, it } from "vitest";

import { ApplicationUser, Seat } from "../../models";
import { buildSeatUserRows } from "../seatUserRows";

const TENANT_ID = "tenant-1";
const OTHER_TENANT_ID = "tenant-2";

function createMember(
  id: string,
  tenantId: string,
  status: string = "Active",
): ApplicationUser {
  return new ApplicationUser({
    id,
    firstName: id,
    lastName: "User",
    email: `${id}@example.com`,
    tenantMembershipsSummary: [
      {
        tenantId,
        tenantDisplayName: tenantId,
        role: "Developer",
        isDefault: true,
        isPrimary: true,
        isOwner: false,
        status,
      },
    ],
  });
}

function createSeat(seatId: string, userId?: string): Seat {
  return new Seat({
    seatId,
    userId,
    status: "Active",
    isBundled: false,
    seatStartDate: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("buildSeatUserRows", () => {
  it("buildSeatUserRows_SeatedOccupant_KeepsStoredSeatRow", () => {
    const occupant = createMember("seated", TENANT_ID);

    const rows = buildSeatUserRows({
      seats: [createSeat("seat-1", occupant.id)],
      users: [occupant],
      tenantId: TENANT_ID,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].seat.seatId).toBe("seat-1");
    expect(rows[0].user).toBe(occupant);
    expect(rows[0].isSyntheticSeat).toBe(false);
  });

  it("buildSeatUserRows_UnseatedTenantMember_AddsSyntheticRow", () => {
    const occupant = createMember("seated", TENANT_ID);
    const unseated = createMember("unseated", TENANT_ID);

    const rows = buildSeatUserRows({
      seats: [createSeat("seat-1", occupant.id)],
      users: [occupant, unseated],
      tenantId: TENANT_ID,
    });

    const unseatedRow = rows.find((row) => row.user?.id === unseated.id);
    expect(rows).toHaveLength(2);
    expect(unseatedRow?.isSyntheticSeat).toBe(true);
    expect(unseatedRow?.seat.userEmail).toBe(unseated.email);
  });

  it("buildSeatUserRows_OtherTenantOrEndedMember_IsExcluded", () => {
    const otherTenantUser = createMember("other", OTHER_TENANT_ID);
    const endedMember = createMember("ended", TENANT_ID, "Ended");

    const rows = buildSeatUserRows({
      seats: [createSeat("seat-1")],
      users: [otherTenantUser, endedMember],
      tenantId: TENANT_ID,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].seat.seatId).toBe("seat-1");
    expect(rows[0].user).toBeUndefined();
  });

  it("buildSeatUserRows_SuspendedMember_IsIncluded", () => {
    const suspended = createMember("suspended", TENANT_ID, "Suspended");

    const rows = buildSeatUserRows({
      seats: [],
      users: [suspended],
      tenantId: TENANT_ID,
    });

    expect(rows.map((row) => row.user?.id)).toEqual([suspended.id]);
  });

  it("buildSeatUserRows_ExcludeInactiveMembers_SkipsSuspendedMember", () => {
    const suspended = createMember("suspended", TENANT_ID, "Suspended");

    const rows = buildSeatUserRows({
      seats: [],
      users: [suspended],
      tenantId: TENANT_ID,
      excludeInactiveMembers: true,
    });

    expect(rows).toHaveLength(0);
  });

  it("buildSeatUserRows_ExcludeInactiveMembers_SkipsDeactivatedAccount", () => {
    const deactivated = createMember("deactivated", TENANT_ID);
    deactivated.isActive = false;

    const rows = buildSeatUserRows({
      seats: [],
      users: [deactivated],
      tenantId: TENANT_ID,
      excludeInactiveMembers: true,
    });

    expect(rows).toHaveLength(0);
  });

  it("buildSeatUserRows_ExcludeInactiveMembers_KeepsActiveUnseatedMember", () => {
    const unseated = createMember("unseated", TENANT_ID);

    const rows = buildSeatUserRows({
      seats: [],
      users: [unseated],
      tenantId: TENANT_ID,
      excludeInactiveMembers: true,
    });

    expect(rows.map((row) => row.user?.id)).toEqual([unseated.id]);
    expect(rows[0].isSyntheticSeat).toBe(true);
  });

  it("buildSeatUserRows_NoSeatsOrMembers_AddsOwnerFallbackRow", () => {
    const owner = createMember("owner", OTHER_TENANT_ID);

    const rows = buildSeatUserRows({
      seats: [],
      users: [owner],
      tenantId: TENANT_ID,
      ownerId: owner.id,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].user).toBe(owner);
    expect(rows[0].isSyntheticSeat).toBe(true);
    expect(rows[0].seat.isBundled).toBe(true);
  });

  it("buildSeatUserRows_OccupiedAndOpenSeats_OrdersOccupiedFirst", () => {
    const occupant = createMember("seated", TENANT_ID);

    const rows = buildSeatUserRows({
      seats: [createSeat("seat-a"), createSeat("seat-b", occupant.id)],
      users: [occupant],
      tenantId: TENANT_ID,
    });

    expect(rows.map((row) => row.seat.seatId)).toEqual(["seat-b", "seat-a"]);
    expect(rows.map((row) => row.seatNumber)).toEqual([1, 2]);
  });
});
