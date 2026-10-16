import type { IAiBuilderOutcomeReason } from "../../models/AiBuilderModels";
import AiBuilderChatMessageContent, {
  type AiBuilderChatMessageVariant,
} from "./AiBuilderChatMessageContent";

interface IAiBuilderOutcomeMessageProps {
  reason: IAiBuilderOutcomeReason;
  message: string;
  variant?: AiBuilderChatMessageVariant;
}

const AiBuilderOutcomeMessage = ({
  reason,
  message,
  variant = "bot",
}: Readonly<IAiBuilderOutcomeMessageProps>) => (
  <div className="space-y-1.5">
    <div className="font-semibold">{reason.title}</div>
    <AiBuilderChatMessageContent content={message} variant={variant} />
    {reason.missingInputs && reason.missingInputs.length > 0 && (
      <div>
        <div className="font-medium">Missing information:</div>
        <ul className="list-disc pl-4">
          {reason.missingInputs.map((input) => (
            <li key={input}>{input}</li>
          ))}
        </ul>
      </div>
    )}
    {reason.details && reason.details.length > 0 && (
      <div>
        <div className="font-medium">Details:</div>
        <ul className="list-disc pl-4">
          {reason.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </div>
    )}
    {reason.suggestedActions && reason.suggestedActions.length > 0 && (
      <div>
        <div className="font-medium">Next step:</div>
        <ul className="list-disc pl-4">
          {reason.suggestedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export default AiBuilderOutcomeMessage;
