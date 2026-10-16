export interface IVerifyCodeRequest {
  email: string;
  code: string;
}

export class VerifyCodeRequest implements IVerifyCodeRequest {
  email: string = "";
  code: string = "";

  constructor(init?: Partial<IVerifyCodeRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
