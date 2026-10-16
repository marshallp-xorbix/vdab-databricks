import { BaseApi } from "./BaseApi";

/**
 * Non-secret, per-environment runtime configuration served by the API at `/api/config`. Resolved at runtime
 * (not baked into the build) so a single build artifact promotes across dev/stg/prd unchanged. Anonymous —
 * the SPA loads it before the user authenticates.
 */
export interface IClientConfig {
  applicationInsightsConnectionString: string | null;
  /**
   * When true, the app runs in passwordless-only mode: route all sign-in to the passwordless flow and hide
   * every password workflow. Mirrors the server `AuthenticationConfiguration.PasswordlessOnly` switch.
   */
  passwordlessOnly: boolean;
  /**
   * How many days an Ended membership can be restored. Mirrors
   * `AccountLifecycleConfiguration.MembershipReinstatementDays` (default 90).
   */
  membershipReinstatementDays: number;
}

/**
 * API client for the anonymous runtime client-configuration endpoint.
 */
export class ClientConfigApi extends BaseApi {
  async getClientConfig(): Promise<IClientConfig> {
    return this.get<IClientConfig>("/api/config");
  }
}

// Export a singleton instance
export const clientConfigApi = new ClientConfigApi();
