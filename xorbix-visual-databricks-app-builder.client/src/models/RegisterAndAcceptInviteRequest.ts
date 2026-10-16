export interface IRegisterAndAcceptInviteRequest {
  token: string;
  firstName: string;
  lastName: string;
  /** Omitted in passwordless-only mode, where the account is created without a password. */
  password?: string;
}
