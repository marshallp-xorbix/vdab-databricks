export interface ILoginRequest {
  email: string;
  password?: string;
}

export class LoginRequest implements ILoginRequest {
  email: string = "";
  password?: string;

  constructor(init?: Partial<ILoginRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
