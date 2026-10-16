import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApplicationUser, Seat } from "../models";
import type { SeatUserRow } from "../types/seatTable";
import SeatRowActionsMenu from "./SeatRowActionsMenu";

const OWNER_ID = "owner-1";
const MEMBER_ID = "member-1";

function createRow(userId?: string): SeatUserRow {
  return {
    seat: new Seat({
      seatId: "seat-1",
      userId,
      status: "Active",
      isBundled: false,
      seatStartDate: new Date(),
    }),
    user: userId
      ? new ApplicationUser({
          id: userId,
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
        })
      : undefined,
    seatNumber: 1,
  };
}

const openMenuButtonName = /open actions menu/i;

describe("SeatRowActionsMenu", () => {
  it("SeatRowActionsMenu_NoApplicableActions_RendersNoTrigger", () => {
    render(
      <SeatRowActionsMenu
        row={createRow()}
        actions={{ onView: vi.fn(), showSeatManagementActions: false }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: openMenuButtonName }),
    ).not.toBeInTheDocument();
  });

  it("SeatRowActionsMenu_AdminWithRemoveFromTenant_ShowsRemoveWithoutView", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onRemoveFromTenant = vi.fn();
    const row = createRow(MEMBER_ID);

    render(
      <SeatRowActionsMenu
        row={row}
        actions={{
          onView,
          showSeatManagementActions: false,
          ownerId: OWNER_ID,
          onRemoveFromTenant,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.queryByRole("menuitem", { name: /view/i }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", { name: "Remove from Tenant" }),
    );

    expect(onRemoveFromTenant).toHaveBeenCalledWith(row);
    expect(onView).not.toHaveBeenCalled();
  });

  it("SeatRowActionsMenu_OwnerRow_DisablesRemoveFromTenant", async () => {
    const user = userEvent.setup();

    render(
      <SeatRowActionsMenu
        row={createRow(OWNER_ID)}
        actions={{
          onView: vi.fn(),
          showSeatManagementActions: false,
          ownerId: OWNER_ID,
          onRemoveFromTenant: vi.fn(),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.getByRole("menuitem", { name: "Remove from Tenant" }),
    ).toHaveAttribute("data-disabled");
  });

  it("SeatRowActionsMenu_CurrentUserRow_HidesRemoveFromTenant", () => {
    render(
      <SeatRowActionsMenu
        row={createRow(MEMBER_ID)}
        actions={{
          onView: vi.fn(),
          showSeatManagementActions: false,
          ownerId: OWNER_ID,
          currentUserId: MEMBER_ID,
          onRemoveFromTenant: vi.fn(),
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: openMenuButtonName }),
    ).not.toBeInTheDocument();
  });

  it("SeatRowActionsMenu_SyntheticSeatRow_HidesSeatApiActions", async () => {
    const user = userEvent.setup();

    render(
      <SeatRowActionsMenu
        row={{ ...createRow(MEMBER_ID), isSyntheticSeat: true }}
        actions={{
          onView: vi.fn(),
          onRemoveUser: vi.fn(),
          onRemoveSeat: vi.fn(),
          ownerId: OWNER_ID,
          onRemoveFromTenant: vi.fn(),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.getByRole("menuitem", { name: "Remove from Tenant" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Remove User" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Remove Seat" }),
    ).not.toBeInTheDocument();
  });

  it("SeatRowActionsMenu_StoredSeatRow_ShowsSeatApiActions", async () => {
    const user = userEvent.setup();

    render(
      <SeatRowActionsMenu
        row={createRow(MEMBER_ID)}
        actions={{
          onView: vi.fn(),
          onRemoveUser: vi.fn(),
          onRemoveSeat: vi.fn(),
          ownerId: OWNER_ID,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.getByRole("menuitem", { name: "Remove User" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Remove Seat" }),
    ).toBeInTheDocument();
  });

  it("SeatRowActionsMenu_ViewerCannotTransferOwnership_HidesMakeOwner", async () => {
    const user = userEvent.setup();

    render(
      <SeatRowActionsMenu
        row={createRow(MEMBER_ID)}
        actions={{
          onView: vi.fn(),
          ownerId: OWNER_ID,
          canTransferOwnership: false,
          onMakeOwner: vi.fn(),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.queryByRole("menuitem", { name: "Make Owner" }),
    ).not.toBeInTheDocument();
  });

  it("SeatRowActionsMenu_OwnerViewer_ShowsMakeOwnerForMember", async () => {
    const user = userEvent.setup();
    const onMakeOwner = vi.fn();
    const row = createRow(MEMBER_ID);

    render(
      <SeatRowActionsMenu
        row={row}
        actions={{
          onView: vi.fn(),
          ownerId: OWNER_ID,
          canTransferOwnership: true,
          onMakeOwner,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));
    await user.click(screen.getByRole("menuitem", { name: "Make Owner" }));

    expect(onMakeOwner).toHaveBeenCalledWith(row);
  });

  it("SeatRowActionsMenu_OwnerRow_DisablesSeatApiActions", async () => {
    const user = userEvent.setup();

    render(
      <SeatRowActionsMenu
        row={createRow(OWNER_ID)}
        actions={{
          onView: vi.fn(),
          onRemoveUser: vi.fn(),
          onRemoveSeat: vi.fn(),
          ownerId: OWNER_ID,
          canTransferOwnership: true,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: openMenuButtonName }));

    expect(
      screen.getByRole("menuitem", { name: "Remove User" }),
    ).toHaveAttribute("data-disabled");
    expect(
      screen.getByRole("menuitem", { name: "Remove Seat" }),
    ).toHaveAttribute("data-disabled");
    expect(
      screen.queryByRole("menuitem", { name: "Make Owner" }),
    ).not.toBeInTheDocument();
  });
});
