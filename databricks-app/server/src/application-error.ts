/** A controlled application failure safe to map to an HTTP problem response. */
export class ApplicationError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;

  constructor(status: number, code: string, title: string, detail: string) {
    super(detail);
    this.name = "ApplicationError";
    this.status = status;
    this.code = code;
    this.title = title;
  }
}
