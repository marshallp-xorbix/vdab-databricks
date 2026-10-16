import { MoreVertical } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { SeatUserColumnActions, SeatUserRow } from "../types/seatTable";

interface ISeatRowActionsMenuProps {
  row: SeatUserRow;
  actions: SeatUserColumnActions;
}

interface SeatRowMenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function buildSeatRowMenuActions(
  row: SeatUserRow,
  actions: SeatUserColumnActions,
): SeatRowMenuAction[] {
  const { user, seat } = row;
  const isPendingCancellation = seat.status === "PendingCancellation";
  const showSeatManagementActions = actions.showSeatManagementActions ?? true;
  // Destructive actions stay disabled on the owner row: removing the owner leaves
  // Tenant.OwnerId pointing at a non-member, so ownership must be transferred first.
  const isOwner = !!actions.ownerId && seat.userId === actions.ownerId;
  const menuActions: SeatRowMenuAction[] = [];

  if (actions.canTransferOwnership && user && !isOwner) {
    menuActions.push({
      label: "Make Owner",
      onSelect: () => actions.onMakeOwner?.(row),
    });
  }

  if (showSeatManagementActions && !row.isSyntheticSeat) {
    menuActions.push(
      {
        label: "Remove User",
        onSelect: () => actions.onRemoveUser?.(row),
        disabled: !user || isPendingCancellation || isOwner,
        destructive: true,
      },
      {
        label: "Remove Seat",
        onSelect: () => actions.onRemoveSeat?.(row),
        disabled: seat.isBundled || isPendingCancellation || isOwner,
        destructive: true,
      },
    );
  }

  const onRemoveFromTenant = actions.onRemoveFromTenant;
  const isCurrentUser = !!user && user.id === actions.currentUserId;
  if (onRemoveFromTenant && user && !isCurrentUser) {
    menuActions.push({
      label: "Remove from Tenant",
      onSelect: () => onRemoveFromTenant(row),
      disabled: isOwner,
      destructive: true,
    });
  }

  return menuActions;
}

/**
 * Three-dot actions menu for a seat row. Renders nothing when no action applies
 * to the row, so an empty dropdown is never shown.
 */
const SeatRowActionsMenu = ({
  row,
  actions,
}: Readonly<ISeatRowActionsMenuProps>) => {
  const menuActions = buildSeatRowMenuActions(row, actions);

  if (menuActions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuActions.map((menuAction) => (
          <DropdownMenuItem
            key={menuAction.label}
            disabled={menuAction.disabled}
            variant={menuAction.destructive ? "destructive" : "default"}
            onClick={menuAction.onSelect}
          >
            {menuAction.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SeatRowActionsMenu;
