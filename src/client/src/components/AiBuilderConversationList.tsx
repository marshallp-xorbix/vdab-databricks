import { useEffect, useRef } from "react";
import type { IAiBuilderResult } from "../models/AiBuilder";
import type { IAiBuilderChatMessage } from "../utils/aiBuilderChatHistory";
import AiBuilderMarkdown from "./AiBuilderMarkdown";
import AiBuilderOutcomeMessage from "./AiBuilderOutcomeMessage";

interface IAiBuilderConversationListProps {
  messages: IAiBuilderChatMessage[];
  progressMessage: string;
  isPending: boolean;
  streamingAssistantId: string | null;
  latestResult: IAiBuilderResult | null;
  appliedVersion: number | null;
  applyError: string | null;
}

/** Renders the active AI Builder transcript with markdown bubbles and live streaming. */
function AiBuilderConversationList({
  messages,
  progressMessage,
  isPending,
  streamingAssistantId,
  latestResult,
  appliedVersion,
  applyError,
}: Readonly<IAiBuilderConversationListProps>) {
  const conversationEndRef = useRef<HTMLLIElement | null>(null);
  const lastMessageId = messages.at(-1)?.id;

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, progressMessage, isPending]);

  return (
    <ol
      aria-label="AI Builder conversation"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-card px-3 py-3"
    >
      {messages.length === 0 ? (
        <li className="text-xs text-muted-foreground">
          Describe the app you want to build and the AI will suggest changes
          for your canvas.
        </li>
      ) : (
        messages.map((message) => {
          const isStreamingAssistant =
            isPending && message.id === streamingAssistantId;
          const showOutcome =
            message.role === "assistant" &&
            Boolean(message.outcome) &&
            !isStreamingAssistant;
          return (
            <li
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-snug ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {message.role === "user" ? (
                  <AiBuilderMarkdown content={message.content} tone="user" />
                ) : showOutcome && message.outcome ? (
                  <AiBuilderOutcomeMessage
                    outcome={message.outcome}
                    message={message.content}
                    suggestedNextStep={
                      message.id !== lastMessageId || !latestResult
                        ? null
                        : applyError
                          ? "Request a new suggestion after saving or reverting draft changes."
                          : message.outcome === "unableToComplete"
                            ? "Ask for a narrower change, or tell the assistant which part to do first."
                            : latestResult.proposal
                                && appliedVersion === latestResult.version
                              ? "Save the app when you are ready."
                              : null
                    }
                  />
                ) : (
                  <div className="space-y-1">
                    {message.content.trim().length > 0 ? (
                      <AiBuilderMarkdown
                        content={
                          isStreamingAssistant && progressMessage
                            ? progressMessage
                            : message.content
                        }
                        tone="assistant"
                      />
                    ) : (
                      <p role="status" aria-live="polite">
                        {progressMessage || "Thinking…"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })
      )}
      <li ref={conversationEndRef} className="h-0 w-0 overflow-hidden" aria-hidden="true" />
    </ol>
  );
}

export default AiBuilderConversationList;
