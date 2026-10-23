import type { ServerResponse } from "node:http";
import { ApplicationError } from "./application-error.ts";

/** Writes a JSON response using the app's common response media type. */
export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

/** Emits one sanitized SSE error after an AI stream has started. */
export function writeSseError(response: ServerResponse, error: ApplicationError): void {
  const data = JSON.stringify({
    title: error.title,
    status: error.status,
    detail: error.message,
  });
  response.write(`event: error\ndata: ${data}\n\n`);
}
