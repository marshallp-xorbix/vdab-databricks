import type { IAuthResponse } from "./AuthResponse";

export interface IRegisterAndAcceptInviteResponse {
  /**
   * Present in passwordless-only mode: a complete auth response that signs the new user in immediately on
   * invite acceptance. Null in password-based mode, where the user signs in separately after registering.
   */
  authResponse?: IAuthResponse | null;
}
