export interface IRegisterRequest {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  tier?: string;
}

export class RegisterRequest implements IRegisterRequest {
  email: string = "";
  password?: string;
  firstName: string = "";
  lastName: string = "";
  tier?: string;

  constructor(init?: Partial<IRegisterRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
