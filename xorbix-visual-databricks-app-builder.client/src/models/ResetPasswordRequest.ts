export interface IResetPasswordRequest {
  email?: string;
  userId?: string;
  token: string;
  newPassword?: string;
  confirmPassword?: string;
}

export class ResetPasswordRequest implements IResetPasswordRequest {
  email?: string;
  userId?: string;
  token: string = "";
  newPassword?: string;
  confirmPassword?: string;

  constructor(init?: Partial<IResetPasswordRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
