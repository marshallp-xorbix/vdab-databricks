import { User } from "lucide-react";
import type { ApplicationUser } from "../../models";

interface ITenantIndividualUserCardProps {
  ownerId?: string;
  owner?: ApplicationUser;
  ownerDisplay: string;
  onView: (userId: string) => void;
}

const TenantIndividualUserCard = ({
  ownerId,
  owner,
  ownerDisplay,
  onView,
}: Readonly<ITenantIndividualUserCardProps>) => {
  const displayName = owner?.fullName || owner?.email || ownerDisplay;

  return (
    <button
      type="button"
      onClick={() => {
        if (ownerId) {
          onView(ownerId);
        }
      }}
      disabled={!ownerId}
      className="flex items-start justify-between rounded-xl border border-border bg-card p-5 text-left shadow-[var(--card-shadow)] transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          User
        </p>
        <h3 className="mt-1 truncate text-lg font-bold text-foreground">
          {displayName}
        </h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {ownerId ?? "No user assigned"}
        </p>
      </div>
      <div className="ml-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <User className="h-5 w-5" />
      </div>
    </button>
  );
};

export default TenantIndividualUserCard;
