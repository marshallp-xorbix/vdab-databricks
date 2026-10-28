import { useRef, useState } from "react";
import { SquarePen, X } from "lucide-react";
import type {
  IAiBuilderConversationMessage,
  IAiBuilderProposal,
  IAiBuilderResult,
} from "../models/AiBuilder";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";
import { useAiBuilder } from "../hooks/useAiBuilder";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface IConversationEntry extends IAiBuilderConversationMessage {
  id: number;
}

interface IAiBuilderPanelProps {
  projectId: string;
  version: number;
  endpoints: IWorkspaceServingEndpoint[];
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;
  initialHistory?: IAiBuilderConversationMessage[];
  isDisabled?: boolean;
  onClose?: () => void;
  onApplyProposal: (proposal: IAiBuilderProposal, version: number) => void | Promise<void>;
}

const MAX_HISTORY_MESSAGES = 20;

/** Accessible AI chat for suggesting edits to the current project draft. */
function AiBuilderPanel({
  projectId,
  version,
  endpoints,
  components,
  workflow,
  customModulesSource,
  initialHistory = [],
  isDisabled = false,
  onClose,
  onApplyProposal,
}: Readonly<IAiBuilderPanelProps>) {
  const availableEndpoints = endpoints.filter(
    (endpoint) =>
      endpoint.readiness === "ready" &&
      (endpoint.permissionLevel === "CAN_QUERY" || endpoint.permissionLevel === "CAN_MANAGE"),
  );
  const [selectedEndpointName, setSelectedEndpointName] = useState("");
  const endpointName = availableEndpoints.some(
    (endpoint) => endpoint.name === selectedEndpointName,
  )
    ? selectedEndpointName
    : availableEndpoints[0]?.name ?? "";
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<IConversationEntry[]>(() =>
    initialHistory.map((message, index) => ({ ...message, id: index })),
  );
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<IAiBuilderResult | null>(null);
  const [latestResultSnapshotKey, setLatestResultSnapshotKey] = useState<string | null>(null);
  const [appliedVersion, setAppliedVersion] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nextMessageIdRef = useRef(initialHistory.length);
  const aiBuilderMutation = useAiBuilder();
  const isPending = aiBuilderMutation.isPending;

  const isEndpointAvailable = availableEndpoints.some((endpoint) => endpoint.name === endpointName);
  const canSubmit =
    !isDisabled &&
    !isPending &&
    isEndpointAvailable &&
    prompt.trim().length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!canSubmit || !trimmedPrompt) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setErrorMessage(null);
    setApplyError(null);
    setProgressMessage("Starting AI Builder…");
    setLatestResult(null);
    setLatestResultSnapshotKey(null);
    setAppliedVersion(null);
    const requestSnapshotKey = createDraftSnapshotKey(
      version,
      components,
      workflow,
      customModulesSource,
    );

    try {
      const result = await aiBuilderMutation.mutateAsync({
        projectId,
        request: {
          version,
          endpointName,
          prompt: trimmedPrompt,
          history: messages
            .slice(-MAX_HISTORY_MESSAGES)
            .map(({ role, content }) => ({ role, content })),
          components,
          workflow,
          customModulesSource,
        },
        onProgress: setProgressMessage,
        signal: abortController.signal,
      });
      setLatestResult(result);
      setLatestResultSnapshotKey(requestSnapshotKey);
      setProgressMessage("");
      setPrompt("");
      const userMessageId = nextMessageIdRef.current;
      nextMessageIdRef.current += 2;
      setMessages((currentMessages) => [
        ...currentMessages,
        { id: userMessageId, role: "user", content: trimmedPrompt },
        { id: userMessageId + 1, role: "assistant", content: result.assistantMessage },
      ]);
    } catch (error) {
      if (abortController.signal.aborted) {
        setProgressMessage("Request cancelled.");
      } else {
        setProgressMessage("");
        setErrorMessage(
          error instanceof Error ? error.message : "AI Builder could not complete the request.",
        );
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  async function handleApplyProposal() {
    const result = latestResult;
    if (!result?.proposal || isApplying || isDisabled) return;
    if (result.version !== version) {
      setApplyError("The project changed after this suggestion. Request a new suggestion before applying it.");
      return;
    }
    const currentSnapshotKey = createDraftSnapshotKey(
      version,
      components,
      workflow,
      customModulesSource,
    );
    if (latestResultSnapshotKey !== currentSnapshotKey) {
      setApplyError("The editable project changed after this suggestion. Request a new suggestion before applying it.");
      return;
    }

    setIsApplying(true);
    setApplyError(null);
    try {
      await onApplyProposal(result.proposal, result.version);
      setAppliedVersion(result.version);
    } catch (error) {
      setApplyError(
        error instanceof Error ? error.message : "The proposal could not be applied to the project draft.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  function handleNewConversation() {
    if (isPending || isApplying) return;
    setMessages([]);
    setPrompt("");
    setProgressMessage("");
    setErrorMessage(null);
    setLatestResult(null);
    setLatestResultSnapshotKey(null);
    setAppliedVersion(null);
    setApplyError(null);
    nextMessageIdRef.current = 0;
  }

  return (
    <section
      aria-labelledby="ai-builder-heading"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="ai-builder-heading" className="text-sm font-semibold">AI Builder</h2>
          <label htmlFor="ai-builder-endpoint" className="sr-only">Serving endpoint</label>
          <select
            id="ai-builder-endpoint"
            name="endpointName"
            className="h-7 max-w-64 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={endpointName}
            disabled={isDisabled || isPending || availableEndpoints.length === 0}
            onChange={(event) => setSelectedEndpointName(event.target.value)}
          >
            <option value="">Select a ready endpoint with query access</option>
            {availableEndpoints.map((endpoint) => (
              <option key={endpoint.name} value={endpoint.name}>{endpoint.name}</option>
            ))}
          </select>
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

      <ol aria-label="AI Builder conversation" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-card px-3 py-3">
        {messages.length === 0 ? (
          <li className="text-xs text-muted-foreground">
            Describe the app you want to build and the AI will suggest changes for your canvas.
          </li>
        ) : messages.map((message) => (
          <li key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-snug ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </li>
        ))}
      </ol>

      {availableEndpoints.length === 0 && (
        <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">
          No ready serving endpoints with query access are available.
        </p>
      )}

      {progressMessage && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {progressMessage}
        </p>
      )}
      {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}

      <form className="shrink-0 border-t border-border bg-muted p-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-2">
          <Label htmlFor="ai-builder-prompt" className="sr-only">What would you like to change?</Label>
          <Textarea
            id="ai-builder-prompt"
            name="prompt"
            placeholder="Describe what you want to build..."
            value={prompt}
            maxLength={4000}
            rows={3}
            className="resize-none bg-background"
            disabled={isDisabled || isPending || !isEndpointAvailable}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="submit" size="sm" aria-label="Generate suggestion" disabled={!canSubmit}>
            {isPending ? "Generating…" : "Send"}
          </Button>
          {isPending && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel request
            </Button>
          )}
        </div>
      </form>

      {latestResult?.proposal && (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <p className="text-sm">A project proposal is ready for review.</p>
          {applyError && <p role="alert" className="text-sm text-destructive">{applyError}</p>}
          <div>
            <Button
              type="button"
              disabled={isDisabled || isApplying || appliedVersion === latestResult.version}
              onClick={() => void handleApplyProposal()}
            >
              {appliedVersion === latestResult.version
                ? "Applied to draft"
                : isApplying
                ? "Applying…"
                : "Apply proposal to draft"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function createDraftSnapshotKey(
  version: number,
  components: IProjectComponent[],
  workflow: IProjectWorkflowDefinition,
  customModulesSource: string,
): string {
  return JSON.stringify({ version, components, workflow, customModulesSource });
}

export default AiBuilderPanel;
