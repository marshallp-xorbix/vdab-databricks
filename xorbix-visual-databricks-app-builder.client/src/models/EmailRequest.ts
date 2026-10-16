export interface IEmailRequest {
  email: string;
}

export class EmailRequest implements IEmailRequest {
  email: string = "";

  constructor(init?: Partial<IEmailRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
