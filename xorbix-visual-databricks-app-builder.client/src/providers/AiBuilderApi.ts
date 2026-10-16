import { BaseApi } from "./BaseApi";
import {
  AiBuilderRequest,
  type CanvasComponentSummary,
  type ConversationMessage,
  type IAiBuilderResponse,
  type WorkflowSummary,
} from "../models/AiBuilderModels";
import {
  AiBuilderStreamError,
  parseAiBuilderSseBuffer,
  parseAiBuilderSseLine,
} from "../utils/parseAiBuilderSseStream";

class AiBuilderApi extends BaseApi {
  async generateStream(
    prompt: string,
    appId: number,
    currentComponents: CanvasComponentSummary[],
    onProgress: (message: string) => void,
    currentWorkflows: WorkflowSummary[] = [],
    conversationHistory: ConversationMessage[] = [],
    customModulesCode = "",
    aiModelId?: number | null,
    signal?: AbortSignal,
  ): Promise<IAiBuilderResponse> {
    const response = await this.fetchWithAuth("/api/AiBuilder/generate-stream", {
      method: "POST",
      body: JSON.stringify(
        new AiBuilderRequest(
          prompt,
          appId,
          currentComponents,
          currentWorkflows,
          conversationHistory,
          customModulesCode,
          aiModelId,
        ),
      ),
      signal,
    });

    if (!response.ok) {
      throw new Error(await this.getStreamErrorMessage(response));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
      }

      if (done) break;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const result = this.processSseLine(line.trimEnd(), onProgress);
        if (result) return result;
      }
    }

    buffer += decoder.decode();
    const result = parseAiBuilderSseBuffer(buffer);
    if (result) return result;

    throw new Error("Stream ended without a result event");
  }

  private processSseLine(
    line: string,
    onProgress: (message: string) => void,
  ): IAiBuilderResponse | null {
    const event = parseAiBuilderSseLine(line);
    if (!event) return null;

    if (event.type === "progress") {
      onProgress(event.message);
      return null;
    }

    if (event.type === "result")
      return event.result;

    if (event.type === "error")
      throw new AiBuilderStreamError(event.message, event.reason);

    return null;
  }

  private async getStreamErrorMessage(response: Response): Promise<string> {
    const fallback = `AI builder stream request failed: ${response.status}`;

    try {
      const text = await response.text();
      if (!text) return fallback;

      try {
        const data = JSON.parse(text) as { error?: unknown; detail?: unknown; title?: unknown };
        if (typeof data.error === "string" && data.error.length > 0) return data.error;
        if (typeof data.detail === "string" && data.detail.length > 0) return data.detail;
        if (typeof data.title === "string" && data.title.length > 0) return data.title;
      } catch {
        return text;
      }
    } catch {
      return fallback;
    }

    return fallback;
  }
}

export const aiBuilderApi = new AiBuilderApi();
