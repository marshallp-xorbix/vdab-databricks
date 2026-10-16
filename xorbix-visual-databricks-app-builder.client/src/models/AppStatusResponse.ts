export interface IAppStatusResponse {
  state?: string;
  message?: string;
}

export class AppStatusResponse implements IAppStatusResponse {
  state?: string;
  message?: string;

  constructor(init?: Partial<IAppStatusResponse>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
