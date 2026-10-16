import { BaseApi } from "../providers/BaseApi";
import { LegalPage, type ILegalPage } from "../models/LegalPage";

/**
 * Fetches sanitized legal page HTML from the VDAB API.
 */
export class LegalPagesApi extends BaseApi {
  /**
   * Loads a legal page by WordPress slug (e.g. privacy-policy).
   */
  async getLegalPage(slug: string): Promise<LegalPage> {
    const response = await this.get<ILegalPage>(
      `/api/legal-pages/${encodeURIComponent(slug)}`,
    );
    return new LegalPage(response);
  }
}

export const legalPagesApi = new LegalPagesApi();
