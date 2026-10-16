import { UserInfo, type IUserInfo } from "./UserInfo";

export interface IAuthenticatedUserClaims extends IUserInfo {
  jti?: string;
  issuedAt?: number;
}

export class AuthenticatedUserClaims
  extends UserInfo
  implements IAuthenticatedUserClaims
{
  jti?: string;
  issuedAt?: number;

  constructor(init?: Partial<IAuthenticatedUserClaims>) {
    super(init);
    if (init) {
      this.jti = init.jti;
      this.issuedAt = init.issuedAt;
    }
  }
}
