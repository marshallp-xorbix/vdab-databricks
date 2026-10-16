import type { IPriorMemberPrompt } from "../models";

interface IPriorMemberChoicePromptProps {
  prompts: IPriorMemberPrompt[];
}

/**
 * Restore-confirmation panel for a prior Detached member of this tenant.
 * Different-person / retire is handled outside this invite flow (support path).
 */
function PriorMemberChoicePrompt({
  prompts,
}: Readonly<IPriorMemberChoicePromptProps>) {
  return (
    <div className="space-y-4">
      {prompts.map((prompt) => {
        const removedOn =
          prompt.removedOn instanceof Date
            ? prompt.removedOn.toLocaleDateString()
            : new Date(prompt.removedOn).toLocaleDateString();
        return (
          <div
            key={prompt.email}
            className="space-y-1 rounded-md border border-border p-3"
          >
            <p className="text-sm font-medium text-foreground">
              {prompt.displayName}
            </p>
            <p className="text-xs text-muted-foreground">{prompt.email}</p>
            <p className="text-xs text-muted-foreground">
              Removed {removedOn} · prior role {prompt.priorRole}
            </p>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        If this email belongs to a different person than the previous member,
        contact VDAB support for help retiring the old account.
      </p>
    </div>
  );
}

export default PriorMemberChoicePrompt;
