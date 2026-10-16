import type { IAuthResponse } from "./AuthResponse";

export interface IConfirmEmailResponse {
  requiresPasswordSetup: boolean;
  userId: string | null;
  passwordResetToken: string | null;
  /**
   * Present in passwordless-only mode: a complete auth response that signs the user in immediately on email
   * confirmation. Null in password-based mode, where the user signs in separately after confirming.
   */
  authResponse?: IAuthResponse | null;
}

export class ConfirmEmailResponse implements IConfirmEmailResponse {
  requiresPasswordSetup: boolean = false;
  userId: string | null = null;
  passwordResetToken: string | null = null;
  authResponse?: IAuthResponse | null = null;

  constructor(init?: Partial<IConfirmEmailResponse>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
