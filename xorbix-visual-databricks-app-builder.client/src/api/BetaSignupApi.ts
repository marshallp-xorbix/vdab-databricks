import { BaseApi } from "../providers/BaseApi";
import { BetaCodeValidation } from "../models";
import type {
  IBetaCodeValidation,
  IBetaRegisterRequest,
  IValidateBetaCodePreviewRequest,
} from "../models";

/**
 * API client for the beta signup flow (anonymous preview + registration).
 */
export class BetaSignupApi extends BaseApi {
  /**
   * Validates a beta code before account creation (no authentication required).
   */
  async validateBetaCodePreview(
    code: string,
    tier?: string,
  ): Promise<BetaCodeValidation> {
    const request: IValidateBetaCodePreviewRequest = { code, tier };
    const data = await this.post<IBetaCodeValidation>(
      "/api/Billing/beta-codes/validate-preview",
      request,
    );
    return new BetaCodeValidation(data);
  }

  /**
   * Registers a new user via the beta signup flow and redeems the beta code.
   */
  async registerBeta(request: IBetaRegisterRequest): Promise<string> {
    return this.post<string>("/api/Identity/register/beta", request);
  }
}

export const betaSignupApi = new BetaSignupApi();
