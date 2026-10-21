import { useMutation } from "@tanstack/react-query";
import {
  generateAiBuilderProposal,
  type AiBuilderProgressHandler,
} from "../api/aiBuilderApi";
import type { IAiBuilderRequest } from "../models/AiBuilder";

export interface IAiBuilderMutationInput {
  projectId: string;
  request: IAiBuilderRequest;
  onProgress?: AiBuilderProgressHandler;
  signal?: AbortSignal;
}

/** Runs a streamed AI proposal request without persisting its project changes. */
export function useAiBuilder() {
  return useMutation({
    mutationFn: ({ projectId, request, onProgress, signal }: IAiBuilderMutationInput) =>
      generateAiBuilderProposal(projectId, request, onProgress, signal),
  });
}

