import type { IUserInfo } from "./UserInfo";
import { parseApiDate } from "../lib/utils";

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | Date;
  twoFactorRequired?: boolean;
  twoFactorExpiresAt?: string | Date;
  /** Server-issued instant at which another two-factor code may be requested. */
  twoFactorResendAvailableAt?: string | Date;
  user?: IUserInfo;
}

export class AuthResponse implements IAuthResponse {
  accessToken: string = "";
  refreshToken: string = "";
  expiresAt: Date = new Date();
  twoFactorRequired?: boolean;
  twoFactorExpiresAt?: Date;
  twoFactorResendAvailableAt?: Date;
  user?: IUserInfo;

  constructor(init?: Partial<IAuthResponse>) {
    if (init) {
      Object.assign(this, init);
      if (init.expiresAt) this.expiresAt = parseApiDate(init.expiresAt);
      if (init.twoFactorExpiresAt)
        this.twoFactorExpiresAt = parseApiDate(init.twoFactorExpiresAt);
      if (init.twoFactorResendAvailableAt)
        this.twoFactorResendAvailableAt = parseApiDate(
          init.twoFactorResendAvailableAt,
        );
    }
  }
}
