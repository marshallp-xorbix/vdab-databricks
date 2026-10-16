/**
 * Response type for OAuth 2.0 token exchange with Databricks
 */
export interface DatabricksTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}
