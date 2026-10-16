import type { ApplicationUser, Seat } from "../models";

/**
 * A seat joined with its assigned user (if any) and its 1-based
 * seat index (stable across renders for display purposes).
 */
export interface SeatUserRow {
  seat: Seat;
  user?: ApplicationUser;
  seatNumber: number;
  /**
   * True when the row stands in for a tenant member without a stored subscription
   * seat. Seat API actions (remove user, remove seat) do not apply to these rows.
   */
  isSyntheticSeat?: boolean;
}

/** Callbacks and permission flags for the seat table's actions column. */
export interface SeatUserColumnActions {
  onView: (userId: string) => void;
  onRemoveUser?: (row: SeatUserRow) => void;
  onRemoveSeat?: (row: SeatUserRow) => void;
  showSeatManagementActions?: boolean;
  /** The current tenant's owner user id, used to flag the owner row. */
  ownerId?: string | null;
  /** Whether the viewer may transfer ownership to another member. */
  canTransferOwnership?: boolean;
  /** Invoked to make the row's user the new tenant owner. */
  onMakeOwner?: (row: SeatUserRow) => void;
  /** Invoked to remove the row's user from the tenant; omit to hide the action. */
  onRemoveFromTenant?: (row: SeatUserRow) => void;
  /** The signed-in user's id; users cannot remove themselves from a tenant. */
  currentUserId?: string;
}
