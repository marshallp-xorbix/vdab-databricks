import { useEffect, useRef, useState } from "react";
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
import {
  AI_BUILDER_REQUEST_HISTORY_LIMIT,
  createAiBuilderChat,
  findActiveAiBuilderChat,
  loadAiBuilderChatStore,
  saveAiBuilderChatStore,
  upsertAiBuilderChat,
  type IAiBuilderChat,
  type IAiBuilderChatMessage,
  type IAiBuilderChatStore,
} from "../utils/aiBuilderChatHistory";

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

const ENDPOINT_STORAGE_KEY = "vdab-ai-builder-endpoint";

/** Owns AI chat requests, local history, cancellation, and draft proposal validation. */
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
  const [selectedEndpointName, setSelectedEndpointName] = useState(() => {
    try {
      return sessionStorage.getItem(ENDPOINT_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const endpointName = availableEndpoints.some(
    (endpoint) => endpoint.name === selectedEndpointName,
  )
    ? selectedEndpointName
    : (availableEndpoints[0]?.name ?? "");
  useEffect(() => {
    if (!endpointName) return;
    try {
      sessionStorage.setItem(ENDPOINT_STORAGE_KEY, endpointName);
    } catch {
      // Session storage can be unavailable in private browsing.
    }
  }, [endpointName]);

  const [chatStore, setChatStore] = useState<IAiBuilderChatStore>(() =>
    createInitialChatStore(projectId, initialHistory),
  );
  const [prompt, setPrompt] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<IAiBuilderResult | null>(null);
  const [latestResultSnapshotKey, setLatestResultSnapshotKey] = useState<string | null>(null);
  const [appliedVersion, setAppliedVersion] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const currentDraftSnapshotKey = createDraftSnapshotKey(
    version,
    components,
    workflow,
    customModulesSource,
  );
  const currentDraftSnapshotKeyRef = useRef(currentDraftSnapshotKey);
  currentDraftSnapshotKeyRef.current = currentDraftSnapshotKey;
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiBuilderMutation = useAiBuilder();
  const isPending = aiBuilderMutation.isPending;

  useEffect(() => {
    setChatStore(createInitialChatStore(projectId, initialHistory));
    setPrompt("");
    setProgressMessage("");
    setErrorMessage(null);
    setLatestResult(null);
    setLatestResultSnapshotKey(null);
    setAppliedVersion(null);
    setApplyError(null);
    setStreamingAssistantId(null);
  }, [projectId]);

  useEffect(() => {
    saveAiBuilderChatStore(projectId, chatStore);
  }, [projectId, chatStore]);

  const activeChat = findActiveAiBuilderChat(chatStore);
  const messages = activeChat?.messages ?? [];
  const isEndpointAvailable = availableEndpoints.some(
    (endpoint) => endpoint.name === endpointName,
  );
  const canSubmit =
    !isDisabled &&
    !isPending &&
    !isApplying &&
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
    setPrompt("");

    const historyForRequest = messages
      .slice(-AI_BUILDER_REQUEST_HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }));
    const userMessage = createMessage("user", trimmedPrompt);
    const assistantMessage = createMessage("assistant", "");
    const requestSnapshotKey = createDraftSnapshotKey(
      version,
      components,
      workflow,
      customModulesSource,
    );

    updateActiveChat((chat) => ({
      ...chat,
      updatedAt: new Date().toISOString(),
      messages: [...chat.messages, userMessage, assistantMessage],
    }));
    setStreamingAssistantId(assistantMessage.id);

    try {
      const result = await aiBuilderMutation.mutateAsync({
        projectId,
        request: {
          version,
          endpointName,
          prompt: trimmedPrompt,
          history: historyForRequest,
          components,
          workflow,
          customModulesSource,
        },
        onProgress: (message) => {
          setProgressMessage(message);
          patchAssistantMessage(assistantMessage.id, message);
        },
        signal: abortController.signal,
      });
      setLatestResult(result);
      setLatestResultSnapshotKey(requestSnapshotKey);
      setProgressMessage("");
      patchAssistantMessage(assistantMessage.id, result.assistantMessage, result.outcome);
      if (result.proposal) {
        await applyProposal(result, requestSnapshotKey);
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        setProgressMessage("");
        patchAssistantMessage(
          assistantMessage.id,
          "Request cancelled.",
          "unableToComplete",
        );
      } else {
        const detail = error instanceof Error
          ? error.message
          : "AI Builder could not complete the request.";
        setProgressMessage("");
        setErrorMessage(null);
        patchAssistantMessage(
          assistantMessage.id,
          detail,
          "unableToComplete",
        );
      }
    } finally {
      setStreamingAssistantId(null);
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
    await applyProposal(result, latestResultSnapshotKey);
  }

  async function applyProposal(
    result: IAiBuilderResult,
    expectedSnapshotKey: string | null,
  ) {
    if (!result.proposal) return;
    if (result.version !== version) {
      setApplyError(
        "The project changed after this suggestion. Request a new suggestion before applying it.",
      );
      return;
    }
    if (expectedSnapshotKey !== currentDraftSnapshotKeyRef.current) {
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
    const nextChat = createAiBuilderChat();
    setChatStore((current) => upsertAiBuilderChat(current, nextChat, true));
    setPrompt("");
    setProgressMessage("");
    setErrorMessage(null);
    setLatestResult(null);
    setLatestResultSnapshotKey(null);
    setAppliedVersion(null);
    setApplyError(null);
    setStreamingAssistantId(null);
  }

  function handleSelectChat(chatId: string) {
    if (isPending || isApplying) return;
    if (!chatStore.chats.some((chat) => chat.id === chatId)) return;
    setChatStore((current) => ({ ...current, activeChatId: chatId }));
    setPrompt("");
    setProgressMessage("");
    setErrorMessage(null);
    setLatestResult(null);
    setLatestResultSnapshotKey(null);
    setAppliedVersion(null);
    setApplyError(null);
    setStreamingAssistantId(null);
  }

  function updateActiveChat(mutate: (chat: IAiBuilderChat) => IAiBuilderChat) {
    setChatStore((current) => {
      const existing = findActiveAiBuilderChat(current) ?? createAiBuilderChat();
      return upsertAiBuilderChat(current, mutate(existing), true);
    });
  }

  function patchAssistantMessage(
    messageId: string,
    content: string,
    outcome?: IAiBuilderChatMessage["outcome"],
  ) {
    setChatStore((current) => {
      const active = findActiveAiBuilderChat(current);
      if (!active) return current;
      return upsertAiBuilderChat(current, {
        ...active,
        updatedAt: new Date().toISOString(),
        messages: active.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content,
                ...(outcome ? { outcome } : {}),
              }
            : message),
      }, true);
    });
  }

  return {
    availableEndpoints,
    endpointName,
    setSelectedEndpointName,
    prompt,
    setPrompt,
    messages,
    chats: chatStore.chats,
    activeChatId: chatStore.activeChatId,
    progressMessage,
    errorMessage,
    latestResult,
    appliedVersion,
    isApplying,
    applyError,
    isPending,
    canSubmit,
    isEndpointAvailable,
    streamingAssistantId,
    handleSubmit,
    handleCancel,
    handleApplyProposal,
    handleNewConversation,
    handleSelectChat,
  };
}

function createInitialChatStore(
  projectId: string,
  initialHistory: IAiBuilderConversationMessage[],
): IAiBuilderChatStore {
  const stored = typeof window === "undefined"
    ? { activeChatId: null, chats: [] }
    : loadAiBuilderChatStore(projectId);
  if (stored.chats.length > 0) return stored;
  if (initialHistory.length === 0) {
    return { activeChatId: null, chats: [] };
  }
  const seeded = createAiBuilderChat(
    initialHistory.map((message) => createMessage(message.role, message.content)),
  );
  return upsertAiBuilderChat({ activeChatId: null, chats: [] }, seeded, true);
}

function createMessage(
  role: "user" | "assistant",
  content: string,
  outcome?: IAiBuilderChatMessage["outcome"],
): IAiBuilderChatMessage {
  return {
    id: createMessageId(),
    role,
    content,
    ...(outcome ? { outcome } : {}),
  };
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
