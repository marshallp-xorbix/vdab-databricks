import type { IAiBuilderOutcomeReason, IAiBuilderResponse } from "../models/AiBuilderModels";

export class AiBuilderStreamError extends Error {
  readonly reason?: IAiBuilderOutcomeReason;

  constructor(message: string, reason?: IAiBuilderOutcomeReason) {
    super(message);
    this.name = "AiBuilderStreamError";
    this.reason = reason;
  }
}

export type AiBuilderSseEvent =
  | { type: "progress"; message: string }
  | { type: "result"; result: IAiBuilderResponse }
  | { type: "error"; message: string; reason?: IAiBuilderOutcomeReason };

export const parseAiBuilderSseLine = (line: string): AiBuilderSseEvent | null => {
  if (!line.startsWith("data: "))
    return null;

  let data: {
    type: string;
    message?: string;
    result?: IAiBuilderResponse;
    reason?: IAiBuilderOutcomeReason;
  };

  try {
    data = JSON.parse(line.slice(6)) as {
      type: string;
      message?: string;
      result?: IAiBuilderResponse;
      reason?: IAiBuilderOutcomeReason;
    };
  } catch {
    throw new Error("AI builder stream returned malformed data.");
  }

  if (data.type === "progress" && data.message)
    return { type: "progress", message: data.message };

  if (data.type === "result" && data.result) {
    if (!Array.isArray(data.result.operations))
      throw new Error("AI builder returned an invalid result payload.");

    data.result.status ??= "completed";
    return { type: "result", result: data.result };
  }

  if (data.type === "error")
    return {
      type: "error",
      message: data.reason?.message ?? data.message ?? "AI builder failed",
      reason: data.reason,
    };

  return null;
};

export const parseAiBuilderSseBuffer = (text: string): IAiBuilderResponse | null => {
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const event = parseAiBuilderSseLine(rawLine.trimEnd());
    if (event?.type === "result")
      return event.result;
  }

  return null;
};
