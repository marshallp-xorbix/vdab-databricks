export interface IFluentError {
  reasons?: string[];
  message?: string;
  metadata?: { [key: string]: unknown };
}

export class FluentError implements IFluentError {
  public reasons: string[] = [];
  public message: string = "";
  public metadata: { [key: string]: unknown } = {};

  constructor(args: IFluentError) {
    Object.assign(this, args);
  }
}
