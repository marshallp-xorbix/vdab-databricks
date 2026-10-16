export interface IRefreshTokenRequest {
  refreshToken: string;
}

export class RefreshTokenRequest implements IRefreshTokenRequest {
  refreshToken: string = "";

  constructor(init?: Partial<IRefreshTokenRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
