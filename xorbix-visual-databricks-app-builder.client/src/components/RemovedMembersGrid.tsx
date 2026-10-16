import { RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import type { RemovedTenantMember } from "../models";

interface IRemovedMembersGridProps {
  members: RemovedTenantMember[];
  onRestore: (member: RemovedTenantMember) => void;
}

/**
 * Table of soft-deleted tenant memberships with Restore actions.
 */
function RemovedMembersGrid({
  members,
  onRestore,
}: Readonly<IRemovedMembersGridProps>) {
  if (members.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No removed members.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Member</th>
            <th className="px-4 py-2">Prior role</th>
            <th className="px-4 py-2">Removed</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map((member) => {
            const removedOn =
              member.removedOn instanceof Date
                ? member.removedOn.toLocaleDateString()
                : new Date(member.removedOn).toLocaleDateString();
            return (
              <tr key={member.userId}>
                <td className="px-4 py-2">
                  <div className="font-medium text-foreground">
                    {member.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{member.role}</td>
                <td className="px-4 py-2 text-muted-foreground">{removedOn}</td>
                <td className="px-4 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore(member)}
                    aria-label={`Restore ${member.email}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RemovedMembersGrid;
