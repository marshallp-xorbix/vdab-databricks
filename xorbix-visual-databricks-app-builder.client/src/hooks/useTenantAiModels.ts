import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantAiModelApi } from "../api/TenantAiModelApi";
import { aiBuilderModelSelectionKeys } from "./useAiBuilderModelSelection";
import type {
  ICreateTenantAiModelRequest,
  IUpdateTenantAiModelRequest,
} from "../models/TenantAiModel";

export const tenantAiModelKeys = {
  all: ["tenantAiModels"] as const,
  list: () => [...tenantAiModelKeys.all, "list"] as const,
};

export function useTenantAiModels(enabled = true) {
  return useQuery({
    queryKey: tenantAiModelKeys.list(),
    queryFn: () => tenantAiModelApi.list(),
    enabled,
  });
}

export function useTenantAiModelMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: tenantAiModelKeys.all });
    await queryClient.invalidateQueries({ queryKey: aiBuilderModelSelectionKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: (request: ICreateTenantAiModelRequest) =>
      tenantAiModelApi.create(request),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: number;
      request: IUpdateTenantAiModelRequest;
    }) => tenantAiModelApi.update(id, request),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantAiModelApi.remove(id),
    onSuccess: invalidate,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
