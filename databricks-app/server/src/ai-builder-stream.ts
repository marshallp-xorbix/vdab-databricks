import { ApplicationError } from "./application-error.ts";
import type { AiBuilderCompletion } from "./ai-builder-contract.ts";
import { AI_BUILDER_TOOL_NAME } from "./ai-builder-tool.ts";

const MAX_STREAM_BYTES = 2_000_000;
const MAX_TOOL_ARGUMENTS_BYTES = 300_000;

interface StreamToolCall {
  name: string;
  arguments: string;
}

/** Reads OpenAI-compatible SSE chunks and returns one bounded tool proposal. */
export async function readAiBuilderCompletion(
  response: Response,
  signal: AbortSignal,
  reportProgress: (message: string) => void,
): Promise<AiBuilderCompletion> {
  if (!response.body) throw invalidModelResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytesRead = 0;
  let assistantMessage = "";
  const toolCall: StreamToolCall = { name: "", arguments: "" };

  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > MAX_STREAM_BYTES) throw invalidModelResponse();
      buffer += decoder.decode(chunk.value, { stream: true });
      let frameBoundary = /\r?\n\r?\n/.exec(buffer);
      while (frameBoundary && frameBoundary.index !== undefined) {
        const frame = buffer.slice(0, frameBoundary.index);
        buffer = buffer.slice(frameBoundary.index + frameBoundary[0].length);
        readFrame(frame, toolCall, (text) => {
          assistantMessage = appendBoundedText(assistantMessage, text);
          reportProgress(text);
        });
        frameBoundary = /\r?\n\r?\n/.exec(buffer);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      readFrame(buffer, toolCall, (text) => {
        assistantMessage = appendBoundedText(assistantMessage, text);
        reportProgress(text);
      });
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof ApplicationError) throw error;
    if (signal.aborted) throw error;
    throw invalidModelResponse();
  } finally {
    reader.releaseLock();
  }

  if (signal.aborted) throw new ApplicationError(499, "ai_request_cancelled", "Request cancelled", "The AI Builder request was cancelled.");
  if (toolCall.name && toolCall.name !== AI_BUILDER_TOOL_NAME) throw invalidModelResponse();
  if (toolCall.name) {
    return {
      assistantMessage,
      toolName: toolCall.name,
      toolArgumentsJson: toolCall.arguments,
    };
  }
  if (assistantMessage.trim().length === 0) throw invalidModelResponse();
  return { assistantMessage, toolName: null, toolArgumentsJson: null };
}

function readFrame(
  frame: string,
  toolCall: StreamToolCall,
  appendAssistantText: (text: string) => void,
): void {
  const payload = frame.split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!payload || payload === "[DONE]") return;

  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw invalidModelResponse();
  }
  if (!isRecord(value)) {
    throw invalidModelResponse();
  }
  if (value.error !== undefined) {
    throw new ApplicationError(502, "ai_endpoint_stream_failed", "Model generation failed", "The selected model endpoint failed while generating a response.");
  }
  if (!Array.isArray(value.choices)) return;
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.delta)) return;
  const delta = choice.delta;
  if (typeof delta.content === "string") appendAssistantText(delta.content);
  if (!Array.isArray(delta.tool_calls)) return;

  for (const candidate of delta.tool_calls) {
    if (!isRecord(candidate) || (candidate.index !== undefined && candidate.index !== 0)) {
      throw invalidModelResponse();
    }
    if (!isRecord(candidate.function)) continue;
    if (typeof candidate.function.name === "string") {
      toolCall.name += candidate.function.name;
    }
    if (typeof candidate.function.arguments === "string") {
      toolCall.arguments = appendBoundedText(toolCall.arguments, candidate.function.arguments, MAX_TOOL_ARGUMENTS_BYTES);
    }
  }
}

function appendBoundedText(current: string, next: string, maximumBytes = MAX_STREAM_BYTES): string {
  const result = current + next;
  if (Buffer.byteLength(result, "utf8") > maximumBytes) throw invalidModelResponse();
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidModelResponse(): ApplicationError {
  return new ApplicationError(502, "invalid_ai_endpoint_response", "Model response invalid", "The selected endpoint returned an unsupported or oversized chat completion. Try a supported endpoint or a smaller project change.");
}
