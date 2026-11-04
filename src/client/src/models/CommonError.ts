import { FluentError } from "./FluentError";
import { ProblemDetails } from "./ProblemDetails";

export interface ICommonError {
  name: string;
  message: string;
  messages: string[];
  status: number;
  stack?: string;
  error?: Error;
  fluentErrors?: FluentError[];
  problemDetails?: ProblemDetails;
}

export class CommonError implements ICommonError {
  public name: string = "";
  public message: string = "";
  public messages: string[] = [];
  public status: number = -1;
  public stack: string = "";
  public error?: Error;
  public fluentErrors?: FluentError[] = [];
  public problemDetails?: ProblemDetails;

  constructor(args: ICommonError) {
    Object.assign(this, args);
  }
}
