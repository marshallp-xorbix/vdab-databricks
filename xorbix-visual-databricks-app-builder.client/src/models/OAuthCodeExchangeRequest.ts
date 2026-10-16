export interface IOAuthCodeExchangeRequest {
  workspaceUrl: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export class OAuthCodeExchangeRequest implements IOAuthCodeExchangeRequest {
  workspaceUrl: string = "";
  code: string = "";
  codeVerifier: string = "";
  redirectUri: string = "";

  constructor(init?: Partial<IOAuthCodeExchangeRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
