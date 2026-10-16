import type { ICodePreviewRequest, ICodePreviewResponse } from "../models";
import { BaseApi } from "./BaseApi";

export class CodeApi extends BaseApi {
  async previewCode(
    request: ICodePreviewRequest,
  ): Promise<ICodePreviewResponse> {
    return this.post<ICodePreviewResponse>("/api/Code/preview", request);
  }

  async getPrebuiltModulesLibrary(): Promise<string> {
    return this.get<string>("/api/Code/prebuilt-modules-library");
  }
}

export const codeApi = new CodeApi();
