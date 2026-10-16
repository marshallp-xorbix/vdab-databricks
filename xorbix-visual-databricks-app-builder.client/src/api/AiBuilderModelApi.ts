import type {
  IAiBuilderModelOption,
  IAiBuilderSelectedModel,
  IPlatformAiUsage,
} from "../models/AiBuilderModels";
import { BaseApi } from "../providers/BaseApi";

class AiBuilderModelApi extends BaseApi {
  async getAvailableModels(): Promise<IAiBuilderModelOption[]> {
    return this.get<IAiBuilderModelOption[]>("/api/AiBuilder/available-models");
  }

  async getSelectedModel(): Promise<IAiBuilderSelectedModel> {
    return this.get<IAiBuilderSelectedModel>("/api/AiBuilder/selected-model");
  }

  async setSelectedModel(
    aiModelId: number | null,
  ): Promise<IAiBuilderSelectedModel> {
    return this.put<IAiBuilderSelectedModel>("/api/AiBuilder/selected-model", {
      aiModelId,
    });
  }

  async getPlatformUsage(): Promise<IPlatformAiUsage> {
    return this.get<IPlatformAiUsage>("/api/AiBuilder/platform-usage");
  }
}

export const aiBuilderModelApi = new AiBuilderModelApi();
