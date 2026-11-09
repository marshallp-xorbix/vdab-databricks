import { ArrowUpIcon, Loader2, SquarePen, X } from "lucide-react";
import AiBuilderModelSelector from "./AiBuilderModelSelector";
import AiBuilderOutcomeMessage from "./AiBuilderOutcomeMessage";
import type {
  IAiBuilderConversationMessage,
  IAiBuilderProposal,
} from "../models/AiBuilder";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";
import { useAiBuilderConversation } from "../hooks/useAiBuilderConversation";
import { Button } from "./ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "./ui/input-group";
import { Label } from "./ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface IAiBuilderPanelProps {
  projectId: string;
  version: number;
  endpoints: IWorkspaceServingEndpoint[];
  endpointsLoading?: boolean;
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;
  initialHistory?: IAiBuilderConversationMessage[];
  isDisabled?: boolean;
  onClose?: () => void;
  onApplyProposal: (
    proposal: IAiBuilderProposal,
    version: number,
  ) => void | Promise<void>;
}

/** Accessible AI chat for suggesting edits to the current project draft. */
function AiBuilderPanel({
  projectId,
  version,
  endpoints,
  endpointsLoading = false,
  components,
  workflow,
  customModulesSource,
  initialHistory = [],
  isDisabled = false,
  onClose,
  onApplyProposal,
}: Readonly<IAiBuilderPanelProps>) {
  const {
    availableEndpoints,
    endpointName,
    setSelectedEndpointName,
    prompt,
    setPrompt,
    messages,
    progressMessage,
    errorMessage,
    latestResult,
    appliedVersion,
    isApplying,
    applyError,
    isPending,
    canSubmit,
    isEndpointAvailable,
    handleSubmit,
    handleCancel,
    handleApplyProposal,
    handleNewConversation,
  } = useAiBuilderConversation({
    projectId,
    version,
    endpoints,
    components,
    workflow,
    customModulesSource,
    initialHistory,
    isDisabled,
    onApplyProposal,
  });

  const showManualApply =
    Boolean(latestResult?.proposal) &&
    appliedVersion !== latestResult?.version;
  const lastAssistantMessageId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  return (
    <section
      aria-labelledby="ai-builder-heading"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="ai-builder-heading" className="text-sm font-semibold">
            AI Builder
          </h2>
          <AiBuilderModelSelector
            endpoints={availableEndpoints}
            value={endpointName}
            disabled={isDisabled || isPending || isApplying}
            isLoading={endpointsLoading}
            onChange={setSelectedEndpointName}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="New conversation"
            aria-label="New conversation"
            disabled={isPending || isApplying}
            onClick={handleNewConversation}
          >
            <SquarePen className="h-4 w-4 text-muted-foreground" />
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Close AI Builder"
              aria-label="Close AI Builder"
              onClick={onClose}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </header>

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
          messages.map((message) => (
            <li
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-snug ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
              >
                {message.role === "assistant" ? (
                  latestResult && message.id === lastAssistantMessageId ? (
                    <AiBuilderOutcomeMessage
                      outcome={latestResult.outcome}
                      message={message.content}
                      suggestedNextStep={
                        applyError
                          ? "Request a new suggestion after saving or reverting draft changes."
                          : appliedVersion === latestResult.version
                            ? "Save the app when you are ready."
                            : null
                      }
                    />
                  ) : (
                    <div className="ai-builder-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </li>
          ))
        )}
        {isPending && progressMessage && (
          <li className="flex justify-start">
            <div
              className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-xs"
              role="status"
              aria-live="polite"
            >
              {progressMessage}
            </div>
          </li>
        )}
      </ol>

      {availableEndpoints.length === 0 && (
        <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">
          No ready serving endpoints with query access are available.
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="px-3 text-sm text-destructive">
          <span className="font-semibold">Unable to complete. </span>
          {errorMessage}
        </p>
      )}

      {showManualApply && (
        <div className="shrink-0 space-y-2 border-t border-border bg-card p-3">
          <p className="text-sm">
            A project proposal is ready but was not applied automatically.
          </p>
          {applyError && (
            <p role="alert" className="text-sm text-destructive">
              {applyError}
            </p>
          )}
          <Button
            type="button"
            disabled={isDisabled || isApplying}
            onClick={() => void handleApplyProposal()}
          >
            {isApplying ? "Applying…" : "Apply proposal to draft"}
          </Button>
        </div>
      )}

      {latestResult?.proposal && appliedVersion === latestResult.version && (
        <p role="status" className="shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          AI changes applied to the draft. Save the app when you are ready.
        </p>
      )}

      <form
        className="shrink-0 border-t border-border bg-muted p-3"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Label htmlFor="ai-builder-prompt" className="sr-only">
          What would you like to change?
        </Label>
        <InputGroup className="bg-background">
          <InputGroupTextarea
            id="ai-builder-prompt"
            name="prompt"
            placeholder="Describe what you want to build..."
            value={prompt}
            maxLength={4000}
            rows={3}
            disabled={isDisabled || isPending || isApplying || !isEndpointAvailable}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <InputGroupAddon align="block-end" className="justify-end">
            {isPending ? (
              <InputGroupButton
                type="button"
                size="icon-sm"
                aria-label="Cancel request"
                onClick={handleCancel}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="sr-only">Cancel request</span>
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-sm"
                aria-label="Generate suggestion"
                disabled={!canSubmit}
              >
                <ArrowUpIcon className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </section>
  );
}

export default AiBuilderPanel;
