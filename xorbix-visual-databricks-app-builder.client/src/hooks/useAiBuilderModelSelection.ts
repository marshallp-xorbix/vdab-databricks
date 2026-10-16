import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiBuilderModelApi } from "../api/AiBuilderModelApi";
import type { IAiBuilderSelectedModel } from "../models/AiBuilderModels";

export const aiBuilderModelSelectionKeys = {
  all: ["aiBuilderModelSelection"] as const,
  available: () => [...aiBuilderModelSelectionKeys.all, "available"] as const,
  selected: () => [...aiBuilderModelSelectionKeys.all, "selected"] as const,
};

export function useAiBuilderModelSelection(enabled = true) {
  const queryClient = useQueryClient();

  const availableQuery = useQuery({
    queryKey: aiBuilderModelSelectionKeys.available(),
    queryFn: () => aiBuilderModelApi.getAvailableModels(),
    enabled,
  });

  const selectedQuery = useQuery({
    queryKey: aiBuilderModelSelectionKeys.selected(),
    queryFn: () => aiBuilderModelApi.getSelectedModel(),
    enabled,
  });

  const setSelectedMutation = useMutation({
    mutationFn: (aiModelId: number | null) =>
      aiBuilderModelApi.setSelectedModel(aiModelId),
    onSuccess: (data: IAiBuilderSelectedModel) => {
      queryClient.setQueryData(aiBuilderModelSelectionKeys.selected(), data);
    },
  });

  return {
    availableModels: availableQuery.data ?? [],
    selectedModel: selectedQuery.data,
    isLoading: availableQuery.isPending || selectedQuery.isPending,
    isPending: availableQuery.isPending || selectedQuery.isPending,
    isError: availableQuery.isError || selectedQuery.isError,
    error: availableQuery.error ?? selectedQuery.error,
    setSelectedModel: setSelectedMutation.mutateAsync,
    isSettingSelected: setSelectedMutation.isPending,
  };
}
