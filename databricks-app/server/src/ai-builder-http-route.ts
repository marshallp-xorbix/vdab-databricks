import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ApplicationError } from "./application-error.ts";
import type { AiBuilderEvent } from "./ai-builder-contract.ts";
import type { AiBuilderService } from "./ai-builder-service.ts";
import type { HttpAppOptions } from "./http-app.ts";
import {
  decodePathSegment,
  parseJsonRequestBody,
} from "./http-request-validation.ts";

/** Streams one caller-authorized AI Builder proposal as server-sent events. */
export async function handleAiBuilderHttpRoute(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpAppOptions,
  requestId: string,
  method: string,
  requestPath: string,
  requestBody: string,
): Promise<boolean> {
  const route = requestPath.match(/^\/api\/v1\/projects\/([^/]+)\/ai-builder$/);
  if (method !== "POST" || !route) return false;
  if (!options.aiBuilderService) {
    throw new ApplicationError(
      503,
      "ai_builder_unavailable",
      "AI Builder unavailable",
      "The AI Builder service is not configured.",
    );
  }

  const caller = await options.identityResolver(request);
  const prepared = await options.aiBuilderService.prepare(
    caller,
    requestId,
    decodePathSegment(route[1]),
    parseJsonRequestBody(requestBody, request.headers["content-type"]),
  );
  await streamAiBuilderResponse(request, response, prepared);
  return true;
}

async function streamAiBuilderResponse(
  request: IncomingMessage,
  response: ServerResponse,
  prepared: Awaited<ReturnType<AiBuilderService["prepare"]>>,
): Promise<void> {
  const cancellation = new AbortController();
  const abortWhenDisconnected = (): void => cancellation.abort();
  const abortOnResponseClose = (): void => {
    if (!response.writableEnded) cancellation.abort();
  };
  request.once("aborted", abortWhenDisconnected);
  response.once("close", abortOnResponseClose);
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-cache, no-transform");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");
  try {
    await prepared.execute(cancellation.signal, async (event) =>
      writeAiBuilderEvent(response, event, cancellation.signal),
    );
    if (!response.destroyed && !response.writableEnded) response.end();
  } finally {
    request.off("aborted", abortWhenDisconnected);
    response.off("close", abortOnResponseClose);
  }
}

async function writeAiBuilderEvent(
  response: ServerResponse,
  event: AiBuilderEvent,
  signal: AbortSignal,
): Promise<void> {
  if (response.destroyed || response.writableEnded || signal.aborted) return;
  const frame = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  if (!response.write(frame)) await once(response, "drain", { signal });
}
