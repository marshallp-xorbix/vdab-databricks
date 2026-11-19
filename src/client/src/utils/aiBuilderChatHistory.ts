import type { AiBuilderOutcome, IAiBuilderConversationMessage } from "../models/AiBuilder";

export const AI_BUILDER_CHAT_HISTORY_LIMIT = 25;
export const AI_BUILDER_CHAT_MESSAGE_LIMIT = 40;
export const AI_BUILDER_REQUEST_HISTORY_LIMIT = 20;

export interface IAiBuilderChatMessage extends IAiBuilderConversationMessage {
  id: string;
  outcome?: AiBuilderOutcome;
}

export interface IAiBuilderChat {
  id: string;
  title: string;
  updatedAt: string;
  messages: IAiBuilderChatMessage[];
}

export interface IAiBuilderChatStore {
  activeChatId: string | null;
  chats: IAiBuilderChat[];
}

/** Builds the localStorage key for one project's AI Builder chats. */
export function createAiBuilderChatStorageKey(projectId: string): string {
  return `vdab-ai-builder-chats:${projectId}`;
}

/** Creates an empty chat with a stable local id. */
export function createAiBuilderChat(
  seedMessages: IAiBuilderChatMessage[] = [],
  now: () => Date = () => new Date(),
): IAiBuilderChat {
  const createdAt = now().toISOString();
  return {
    id: createLocalId(),
    title: deriveChatTitle(seedMessages),
    updatedAt: createdAt,
    messages: seedMessages.slice(-AI_BUILDER_CHAT_MESSAGE_LIMIT),
  };
}

/** Derives a short list title from the first user message. */
export function deriveChatTitle(messages: ReadonlyArray<IAiBuilderChatMessage>): string {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "New chat";
  const compact = firstUserMessage.replace(/\s+/g, " ");
  return compact.length > 48 ? `${compact.slice(0, 45).trimEnd()}…` : compact;
}

/** Loads and validates the project-scoped chat store from localStorage. */
export function loadAiBuilderChatStore(projectId: string): IAiBuilderChatStore {
  try {
    const raw = window.localStorage.getItem(createAiBuilderChatStorageKey(projectId));
    if (!raw) return { activeChatId: null, chats: [] };
    return normalizeChatStore(JSON.parse(raw) as unknown);
  } catch {
    return { activeChatId: null, chats: [] };
  }
}

/** Persists the project-scoped chat store, dropping oldest chats beyond the cap. */
export function saveAiBuilderChatStore(projectId: string, store: IAiBuilderChatStore): void {
  const normalized = normalizeChatStore(store);
  try {
    window.localStorage.setItem(
      createAiBuilderChatStorageKey(projectId),
      JSON.stringify(normalized),
    );
  } catch {
    // Private browsing or quota failures should not break the live chat.
  }
}

/** Upserts one chat and keeps the active pointer and size bounds. */
export function upsertAiBuilderChat(
  store: IAiBuilderChatStore,
  chat: IAiBuilderChat,
  activate = true,
): IAiBuilderChatStore {
  const nextChat: IAiBuilderChat = {
    ...chat,
    title: deriveChatTitle(chat.messages),
    messages: chat.messages.slice(-AI_BUILDER_CHAT_MESSAGE_LIMIT),
    updatedAt: chat.updatedAt || new Date().toISOString(),
  };
  const remaining = store.chats.filter((item) => item.id !== nextChat.id);
  const chats = [nextChat, ...remaining]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, AI_BUILDER_CHAT_HISTORY_LIMIT);
  return {
    activeChatId: activate ? nextChat.id : store.activeChatId,
    chats,
  };
}

/** Returns the active chat when present. */
export function findActiveAiBuilderChat(store: IAiBuilderChatStore): IAiBuilderChat | null {
  if (!store.activeChatId) return null;
  return store.chats.find((chat) => chat.id === store.activeChatId) ?? null;
}

function normalizeChatStore(value: unknown): IAiBuilderChatStore {
  if (!isRecord(value) || !Array.isArray(value.chats)) {
    return { activeChatId: null, chats: [] };
  }
  const chats = value.chats
    .map(readChat)
    .filter((chat): chat is IAiBuilderChat => chat !== null)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, AI_BUILDER_CHAT_HISTORY_LIMIT);
  const activeChatId = typeof value.activeChatId === "string"
    && chats.some((chat) => chat.id === value.activeChatId)
    ? value.activeChatId
    : (chats[0]?.id ?? null);
  return { activeChatId, chats };
}

function readChat(value: unknown): IAiBuilderChat | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length < 1
      || typeof value.updatedAt !== "string" || !Array.isArray(value.messages)) {
    return null;
  }
  const messages = value.messages
    .map(readMessage)
    .filter((message): message is IAiBuilderChatMessage => message !== null)
    .slice(-AI_BUILDER_CHAT_MESSAGE_LIMIT);
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim().length > 0
      ? value.title.trim().slice(0, 80)
      : deriveChatTitle(messages),
    updatedAt: value.updatedAt,
    messages,
  };
}

function readMessage(value: unknown): IAiBuilderChatMessage | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length < 1
      || (value.role !== "user" && value.role !== "assistant")
      || typeof value.content !== "string") {
    return null;
  }
  const outcome = value.outcome === "completed"
      || value.outcome === "partial"
      || value.outcome === "needsClarification"
      || value.outcome === "unableToComplete"
    ? value.outcome
    : undefined;
  return {
    id: value.id,
    role: value.role,
    content: value.content.slice(0, 8_000),
    ...(outcome ? { outcome } : {}),
  };
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
