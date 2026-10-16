import type { IAiBuilderResponse } from "../models/AiBuilderModels";

export const getAiBuilderResponseMessage = (response: IAiBuilderResponse): string =>
  response.reason?.message ||
  response.explanation ||
  `Applied ${response.operations.length} change${response.operations.length === 1 ? "" : "s"} to the canvas.`;

export const shouldApplyAiBuilderOperations = (response: IAiBuilderResponse): boolean =>
  response.status !== "needsClarification" && response.status !== "unableToComplete";
