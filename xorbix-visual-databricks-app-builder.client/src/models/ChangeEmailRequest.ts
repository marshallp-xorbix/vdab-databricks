export interface IChangeEmailRequest {
  newEmail: string;
  currentPassword?: string;
}

export class ChangeEmailRequest implements IChangeEmailRequest {
  newEmail: string = "";
  currentPassword?: string;

  constructor(init?: Partial<IChangeEmailRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
