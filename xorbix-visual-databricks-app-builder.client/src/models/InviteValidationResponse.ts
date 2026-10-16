export interface IInviteValidationResponse {
  isValid: boolean;
  email?: string;
  tenantDisplayName?: string;
  tenantId?: string;
  tokenExpiresAt?: string | Date;
  /**
   * Whether a user account already exists for the invited email. Only set when
   * `isValid` is true. Drives the login-redirect vs. create-account UX branch.
   */
  userExists?: boolean;
  reason?: string;
}
