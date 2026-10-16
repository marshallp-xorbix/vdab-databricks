export interface IProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  stackTrace?: string;
  errors?: string[] | Record<string, string[]>;
  [key: string]: unknown;
}

export class ProblemDetails implements IProblemDetails {
  public type: string = "";
  public title: string = "";
  public status: number = -1;
  public detail: string = "";
  public instance: string = "";
  public traceId: string = "";
  public stackTrace: string = "";
  public errors?: string[] | Record<string, string[]>;

  constructor(args?: Partial<IProblemDetails>) {
    if (args) {
      Object.assign(this, args);
    }
  }
}
