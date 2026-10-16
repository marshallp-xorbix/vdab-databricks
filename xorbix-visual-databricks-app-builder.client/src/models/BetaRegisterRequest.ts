export interface IValidateBetaCodePreviewRequest {
  code: string;
  tier?: string;
}

export interface IBetaRegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  tier: string;
  betaCode: string;
}

export class BetaRegisterRequest implements IBetaRegisterRequest {
  email: string = "";
  firstName: string = "";
  lastName: string = "";
  tier: string = "";
  betaCode: string = "";

  constructor(init?: Partial<IBetaRegisterRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
