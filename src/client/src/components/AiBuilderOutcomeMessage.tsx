import type { AiBuilderOutcome } from "../models/AiBuilder";
import AiBuilderMarkdown from "./AiBuilderMarkdown";

interface IAiBuilderOutcomeMessageProps {
  outcome: AiBuilderOutcome;
  message: string;
  suggestedNextStep?: string | null;
}

const OUTCOME_TITLES: Record<AiBuilderOutcome, string> = {
  completed: "Completed",
  partial: "Partial result",
  needsClarification: "Needs clarification",
  unableToComplete: "Unable to complete",
};

/** Renders a titled AI Builder outcome with markdown body and optional next step. */
function AiBuilderOutcomeMessage({
  outcome,
  message,
  suggestedNextStep = null,
}: Readonly<IAiBuilderOutcomeMessageProps>) {
  return (
    <div className="space-y-1.5">
      <div className="font-semibold">{OUTCOME_TITLES[outcome]}</div>
      <AiBuilderMarkdown content={message} tone="assistant" />
      {suggestedNextStep ? (
        <div>
          <div className="font-medium">Next step:</div>
          <p>{suggestedNextStep}</p>
        </div>
      ) : null}
    </div>
  );
}

export default AiBuilderOutcomeMessage;
