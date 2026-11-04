export interface IApplicationLog {
  message: string;
  type: "info" | "warning" | "error";
  timestamp?: string;
}
