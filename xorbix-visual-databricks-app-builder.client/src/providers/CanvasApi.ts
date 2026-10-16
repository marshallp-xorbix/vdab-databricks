import { BaseApi } from "./BaseApi";
import type { VdabComponent } from "../types/components";
import type { BindingSchema } from "../types/components/bindings";

export interface ComponentRegistryResponse {
  components: VdabComponent[];
  bindingSchemas: BindingSchema[];
  version: number;
}

/**
 * API client for component registry operations
 */
export class CanvasApi extends BaseApi {
  /**
   * Fetch the complete component registry from the backend
   */
  async getRegistry(): Promise<ComponentRegistryResponse> {
    return this.get<ComponentRegistryResponse>("/api/ComponentRegistry");
  }

  async getComponentDefinition(type: string): Promise<VdabComponent> {
    return this.get<VdabComponent>(`/api/ComponentRegistry/${type}`);
  }
}

// Export a singleton instance
export const canvasApi = new CanvasApi();
