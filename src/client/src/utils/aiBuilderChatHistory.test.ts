import { afterEach, describe, expect, it } from "vitest";
import {
  createAiBuilderChat,
  createAiBuilderChatStorageKey,
  deriveChatTitle,
  loadAiBuilderChatStore,
  saveAiBuilderChatStore,
  upsertAiBuilderChat,
} from "./aiBuilderChatHistory";

afterEach(() => {
  window.localStorage.clear();
});

describe("aiBuilderChatHistory", () => {
  it("derives titles and upserts the active chat with bounds", () => {
    const chat = createAiBuilderChat([
      {
        id: "u1",
        role: "user",
        content: "Build a dashboard with filters and charts for sales",
      },
    ]);
    expect(deriveChatTitle(chat.messages)).toMatch(/^Build a dashboard/);
    expect(chat.title).toMatch(/^Build a dashboard/);

    const store = upsertAiBuilderChat({ activeChatId: null, chats: [] }, chat, true);
    expect(store.activeChatId).toBe(chat.id);
    expect(store.chats).toHaveLength(1);

    saveAiBuilderChatStore("project-one", store);
    expect(loadAiBuilderChatStore("project-one")).toEqual(store);
    expect(createAiBuilderChatStorageKey("project-one")).toBe(
      "vdab-ai-builder-chats:project-one",
    );
  });

  it("ignores malformed storage and keeps a valid active chat pointer", () => {
    window.localStorage.setItem(
      createAiBuilderChatStorageKey("project-one"),
      "{not-json",
    );
    expect(loadAiBuilderChatStore("project-one")).toEqual({
      activeChatId: null,
      chats: [],
    });

    const first = createAiBuilderChat([{ id: "1", role: "user", content: "One" }]);
    const second = createAiBuilderChat([{ id: "2", role: "user", content: "Two" }]);
    const store = upsertAiBuilderChat(
      upsertAiBuilderChat({ activeChatId: null, chats: [] }, first, true),
      second,
      true,
    );
    saveAiBuilderChatStore("project-one", {
      activeChatId: "missing",
      chats: store.chats,
    });
    const loaded = loadAiBuilderChatStore("project-one");
    expect(loaded.activeChatId).toBe(store.chats[0]?.id ?? null);
  });
});
