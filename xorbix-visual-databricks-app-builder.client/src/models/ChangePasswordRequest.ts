export interface IChangePasswordRequest {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export class ChangePasswordRequest implements IChangePasswordRequest {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;

  constructor(init?: Partial<IChangePasswordRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
