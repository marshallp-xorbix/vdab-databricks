import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, ArrowUpIcon, Loader2, SquarePen } from "lucide-react";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from "../ui/input-group";
import { Separator } from "../ui/separator";
import { toast } from "../ui/use-toast";
import { aiBuilderApi } from "../../providers/AiBuilderApi";
import type { VdabComponent } from "../../types/components/vdabComponent";
import type { Workflow } from "../../types/workflow/workflowDefinition";
import type {
  AiBuilderCompletionStatus,
  CanvasOperation,
  IAiBuilderOutcomeReason,
} from "../../models/AiBuilderModels";
import {
  buildConversationHistory,
  mapComponentsToSummaries,
  mapWorkflowsToSummaries,
} from "../../utils/aiBuilderRequestSummaries";
import {
  getAiBuilderResponseMessage,
  shouldApplyAiBuilderOperations,
} from "../../utils/aiBuilderResponseMessages";
import { AiBuilderStreamError } from "../../utils/parseAiBuilderSseStream";
import AiBuilderOutcomeMessage from "./AiBuilderOutcomeMessage";
import AiBuilderModelSelector from "./AiBuilderModelSelector";
import { useAiBuilderModelSelection } from "../../hooks/useAiBuilderModelSelection";
import {
  usePlatformAiUsage,
  aiBuilderPlatformUsageKeys,
} from "../../hooks/usePlatformAiUsage";
import PlatformAiUsageMeter from "../aiBuilder/PlatformAiUsageMeter";
import AiBuilderChatMessageContent from "./AiBuilderChatMessageContent";

interface IAiBuilderChatProps {
  isOpen: boolean;
  onClose: () => void;
  appId: number | null;
  currentComponents: VdabComponent[];
  currentWorkflows: Workflow[];
  customModulesCode: string;
  onApplyOperations: (operations: CanvasOperation[]) => Promise<void> | void;
}

type ChatMessage = {
  id: number;
  sender: "user" | "bot";
  text: string;
  status?: AiBuilderCompletionStatus;
  reason?: IAiBuilderOutcomeReason;
};

const AiBuilderChat = ({
  isOpen,
  onClose,
  appId,
  currentComponents,
  currentWorkflows,
  customModulesCode,
  onApplyOperations,
}: Readonly<IAiBuilderChatProps>) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(1);
  const liveBotMessageIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const {
    availableModels,
    selectedModel,
    isLoading: isModelSelectionLoading,
    isError: isModelSelectionError,
    error: modelSelectionError,
    setSelectedModel,
    isSettingSelected,
  } = useAiBuilderModelSelection(isOpen);

  const selectedModelId = selectedModel?.aiModelId ?? null;
  const isPlatformDefaultSelected = selectedModelId === null;
  const {
    usage: platformUsage,
    isLoading: isPlatformUsageLoading,
    isRefreshing: isPlatformUsageRefreshing,
    refetch: refetchPlatformUsage,
  } = usePlatformAiUsage(isOpen && isPlatformDefaultSelected);

  const selectedDisplayName =
    selectedModel?.displayName ??
    availableModels.find((model) => model.id === null)?.displayName ??
    "VDAB Default";
  const modelSelectionErrorMessage =
    modelSelectionError instanceof Error
      ? modelSelectionError.message
      : "Could not load AI model options.";
  const isSubmitDisabled =
    isLoading ||
    !appId ||
    isModelSelectionLoading ||
    isModelSelectionError ||
    (isPlatformDefaultSelected && (platformUsage?.isLimitReached ?? false));

  const handleModelSelect = async (modelId: number | null) => {
    try {
      await setSelectedModel(modelId);
    } catch (error) {
      toast({
        title: "Could not update AI model",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const addMessage = (sender: "user" | "bot", text: string) => {
    setMessages((prev) => [...prev, { id: nextIdRef.current++, sender, text }]);
  };

  const updateLiveBotMessage = (
    text: string,
    metadata?: Pick<ChatMessage, "status" | "reason">,
  ) => {
    const id = liveBotMessageIdRef.current;
    if (id === null) return;
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, text, ...metadata } : message,
      ),
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isSubmitDisabled) return;

    const historySnapshot = buildConversationHistory(messages);

    addMessage("user", trimmed);
    setInputValue("");
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const liveId = nextIdRef.current++;
    liveBotMessageIdRef.current = liveId;
    setMessages((prev) => [
      ...prev,
      { id: liveId, sender: "bot", text: "Analyzing your request..." },
    ]);

    try {
      const response = await aiBuilderApi.generateStream(
        trimmed,
        appId,
        mapComponentsToSummaries(currentComponents),
        (progressMessage) => updateLiveBotMessage(progressMessage),
        mapWorkflowsToSummaries(currentWorkflows),
        historySnapshot,
        customModulesCode,
        selectedModelId,
        abortController.signal,
      );

      if (!shouldApplyAiBuilderOperations(response)) {
        updateLiveBotMessage(getAiBuilderResponseMessage(response), {
          status: response.status,
          reason: response.reason,
        });
        return;
      }

      if (response.operations.length > 0) {
        await onApplyOperations(response.operations);
        toast({
          title: "AI changes applied",
          description:
            "Save the app when you are ready to persist these changes.",
        });
      }

      updateLiveBotMessage(
        response.operations.length === 0
          ? response.explanation ||
              "No changes were made. Try describing what you want in more detail."
          : getAiBuilderResponseMessage(response),
        {
          status: response.status,
          reason: response.reason,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        updateLiveBotMessage("Request cancelled.");
        return;
      }

      console.error("[AIBuilderChat] Error:", error);

      if (error instanceof AiBuilderStreamError && error.reason) {
        updateLiveBotMessage(error.message, {
          status: "unableToComplete",
          reason: error.reason,
        });
        toast({
          title: "AI Builder error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      updateLiveBotMessage("Something went wrong. Please try again.");
      toast({
        title: "AI Builder error",
        description:
          error instanceof Error
            ? error.message
            : "Could not generate components. Check your configuration.",
        variant: "destructive",
      });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      liveBotMessageIdRef.current = null;
      setIsLoading(false);
      if (isPlatformDefaultSelected) {
        void queryClient.invalidateQueries({
          queryKey: aiBuilderPlatformUsageKeys.current(),
        });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-40 w-96 max-w-full h-[70vh] rounded-xl border-2 border-primary bg-card shadow-xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">AI Builder</h2>
          {isModelSelectionError && (
            <p className="text-[11px] text-destructive" role="alert">
              {modelSelectionErrorMessage}
            </p>
          )}
          <AiBuilderModelSelector
            availableModels={availableModels}
            selectedModelId={selectedModelId}
            selectedDisplayName={selectedDisplayName}
            disabled={isLoading || isSettingSelected}
            isLoading={isModelSelectionLoading}
            onSelect={(modelId) => void handleModelSelect(modelId)}
          />
          {isPlatformDefaultSelected && (
            <PlatformAiUsageMeter
              usage={platformUsage}
              isLoading={isPlatformUsageLoading}
              isRefreshing={isPlatformUsageRefreshing}
              onRefresh={() => void refetchPlatformUsage()}
              compact
            />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              nextIdRef.current = 1;
            }}
            className="p-1 rounded-md hover:bg-muted/70"
            title="New conversation"
            aria-label="New conversation"
            disabled={isLoading}
          >
            <SquarePen className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted/70"
            aria-label="Close AI Builder"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-3 py-3 space-y-2 bg-card overflow-hidden">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Describe the app you want to build and the AI will scaffold it on
            the canvas.
          </p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {messages.map((msg, index) => {
            const isLive = isLoading && index === messages.length - 1;
            return (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-snug ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.reason ? (
                    <AiBuilderOutcomeMessage
                      reason={msg.reason}
                      message={msg.text}
                      variant={msg.sender}
                    />
                  ) : (
                    <AiBuilderChatMessageContent
                      content={msg.text}
                      variant={msg.sender}
                    />
                  )}
                  {isLive && (
                    <Loader2 className="inline-block ml-1.5 h-3 w-3 animate-spin text-muted-foreground align-middle" />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t bg-muted">
        <div className="p-3">
          <form onSubmit={handleSubmit}>
            <InputGroup>
              <InputGroupTextarea
                placeholder="Describe what you want to build..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                rows={6}
                className="field-sizing-fixed"
                disabled={isLoading}
              />
              <InputGroupAddon align="block-end">
                <Separator orientation="vertical" className="!h-4 ml-auto" />
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-xs"
                  disabled={!inputValue.trim() || isSubmitDisabled}
                  className="rounded-full bg-primary hover:bg-primary/90"
                >
                  <ArrowUpIcon className="w-3 h-3" />
                  <span className="sr-only">Send</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AiBuilderChat;

// Named export retained for gradual migration of imports.
export { AiBuilderChat };
