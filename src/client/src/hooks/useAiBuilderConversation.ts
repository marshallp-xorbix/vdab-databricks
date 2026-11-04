import { useRef, useState } from "react";
import type {
  IAiBuilderConversationMessage,
  IAiBuilderProposal,
  IAiBuilderResult,
} from "../models/AiBuilder";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../models/ProjectWorkflow";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";
import { WORKSPACE_CHAT_ENDPOINT_TASK } from "../models/WorkspaceServingEndpoint";
import { useAiBuilder } from "./useAiBuilder";
import { createDraftSnapshotKey } from "../utils/aiBuilderDraftSnapshot";

interface IConversationEntry extends IAiBuilderConversationMessage {
  id: number;
}
interface UseAiBuilderConversationOptions {
  projectId: string;
  version: number;
  endpoints: IWorkspaceServingEndpoint[];
  components: IProjectComponent[];
  workflow: IProjectWorkflowDefinition;
  customModulesSource: string;
  initialHistory: IAiBuilderConversationMessage[];
  isDisabled: boolean;
  onApplyProposal: (
    proposal: IAiBuilderProposal,
    version: number,
  ) => void | Promise<void>;
}
const MAX_HISTORY_MESSAGES = 20;

/** Owns AI conversation requests, cancellation and draft proposal validation. */
export function useAiBuilderConversation({
  projectId,
  version,
  endpoints,
  components,
  workflow,
  customModulesSource,
  initialHistory,
  isDisabled,
  onApplyProposal,
}: Readonly<UseAiBuilderConversationOptions>) {
  const availableEndpoints = endpoints.filter(
    (endpoint) =>
      endpoint.readiness === "ready" &&
      (endpoint.task === undefined ||
        endpoint.task === WORKSPACE_CHAT_ENDPOINT_TASK) &&
      (endpoint.permissionLevel === "CAN_QUERY" ||
        endpoint.permissionLevel === "CAN_MANAGE"),
  );
  const [selectedEndpointName, setSelectedEndpointName] = useState("");
  const endpointName = availableEndpoints.some(
    (endpoint) => endpoint.name === selectedEndpointName,
  )
    ? selectedEndpointName
    : (availableEndpoints[0]?.name ?? "");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<IConversationEntry[]>(() =>
    initialHistory.map((message, index) => ({ ...message, id: index })),
  );
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<IAiBuilderResult | null>(
    null,
  );
  const [latestResultSnapshotKey, setLatestResultSnapshotKey] = useState<
    string | null
  >(null);
  const [appliedVersion, setAppliedVersion] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nextMessageIdRef = useRef(initialHistory.length);
  const aiBuilderMutation = useAiBuilder();
  const isPending = aiBuilderMutation.isPending;

  const isEndpointAvailable = availableEndpoints.some(
    (endpoint) => endpoint.name === endpointName,
  );
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
        {
          id: userMessageId + 1,
          role: "assistant",
          content: result.assistantMessage,
        },
      ]);
    } catch (error) {
      if (abortController.signal.aborted) {
        setProgressMessage("Request cancelled.");
      } else {
        setProgressMessage("");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "AI Builder could not complete the request.",
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
      setApplyError(
        "The project changed after this suggestion. Request a new suggestion before applying it.",
      );
      return;
    }
    const currentSnapshotKey = createDraftSnapshotKey(
      version,
      components,
      workflow,
      customModulesSource,
    );
    if (latestResultSnapshotKey !== currentSnapshotKey) {
      setApplyError(
        "The editable project changed after this suggestion. Request a new suggestion before applying it.",
      );
      return;
    }

    setIsApplying(true);
    setApplyError(null);
    try {
      await onApplyProposal(result.proposal, result.version);
      setAppliedVersion(result.version);
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : "The proposal could not be applied to the project draft.",
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

  return {
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
  };
}
