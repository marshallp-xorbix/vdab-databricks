export interface IConfirmEmailRequest {
  userId: string;
  token: string;
}

export class ConfirmEmailRequest implements IConfirmEmailRequest {
  userId: string = "";
  token: string = "";

  constructor(init?: Partial<IConfirmEmailRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
