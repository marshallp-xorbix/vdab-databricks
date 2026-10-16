export interface ISetupIntent {
  clientSecret: string;
}

export class SetupIntent implements ISetupIntent {
  clientSecret: string = "";

  constructor(init?: Partial<ISetupIntent>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
