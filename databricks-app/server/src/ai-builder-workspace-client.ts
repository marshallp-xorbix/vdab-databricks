import { ApplicationError } from "./application-error.ts";
import type { CallerIdentity } from "./contracts.ts";
import { AI_BUILDER_TOOLS } from "./ai-builder-tool.ts";
import { normalizeWorkspaceHost } from "./workspace-host.ts";

const INVOCATION_TIMEOUT_MS = 120_000;
const AI_BUILDER_MAX_OUTPUT_TOKENS = 8_192;

/** Calls a selected endpoint through the trusted installed workspace origin. */
export class AiBuilderWorkspaceClient {
  private readonly workspaceHost: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(workspaceHost: string, fetchImplementation: typeof fetch = fetch) {
    this.workspaceHost = normalizeWorkspaceHost(workspaceHost);
    this.fetchImplementation = fetchImplementation;
  }

  async invoke(
    caller: CallerIdentity,
    endpointName: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    signal: AbortSignal,
  ): Promise<Response> {
    const accessToken = caller.authenticationMode === "databricks"
      ? caller.databricksAccessToken
      : null;
    if (!accessToken) {
      throw new ApplicationError(
        401,
        "databricks_session_required",
        "Databricks sign-in required",
        "Open VDAB through Databricks and grant the requested model-serving access.",
      );
    }

    const endpoint = new URL(
      `/serving-endpoints/${encodeURIComponent(endpointName)}/invocations`,
      this.workspaceHost,
    );
    const timeoutSignal = AbortSignal.timeout(INVOCATION_TIMEOUT_MS);
    const requestSignal = AbortSignal.any([signal, timeoutSignal]);
    let response: Response;
    try {
      response = await this.fetchImplementation(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          messages,
          tools: AI_BUILDER_TOOLS,
          tool_choice: "auto",
          stream: true,
          max_tokens: AI_BUILDER_MAX_OUTPUT_TOKENS,
        }),
        redirect: "error",
        signal: requestSignal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      if (timeoutSignal.aborted) {
        throw new ApplicationError(504, "ai_endpoint_timeout", "Model request timed out", "The selected endpoint did not respond before the request timeout.");
      }
      throw new ApplicationError(502, "ai_endpoint_unavailable", "Model endpoint unavailable", "The selected model endpoint could not be reached in this workspace.");
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw mapEndpointFailure(response.status);
    }
    if (!response.headers.get("content-type")?.toLowerCase().includes("text/event-stream") || !response.body) {
      await response.body?.cancel();
      throw new ApplicationError(502, "ai_endpoint_stream_unsupported", "Model response unsupported", "The selected endpoint did not return a streaming chat completion. Confirm that it supports Databricks function calling.");
    }
    return response;
  }
}

function mapEndpointFailure(status: number): ApplicationError {
  if (status === 401) {
    return new ApplicationError(401, "ai_endpoint_authentication_required", "Model authorization required", "Reopen VDAB and grant the model-serving scope requested by Databricks.");
  }
  if (status === 403) {
    return new ApplicationError(403, "ai_endpoint_permission_denied", "Model access denied", "The signed-in user needs permission to query this serving endpoint.");
  }
  if (status === 404) {
    return new ApplicationError(404, "ai_endpoint_not_found", "Model endpoint unavailable", "The selected endpoint is no longer available in this workspace.");
  }
  if (status === 429) {
    return new ApplicationError(429, "ai_endpoint_rate_limited", "Model endpoint is busy", "The selected endpoint is rate limited. Wait and try again.");
  }
  return new ApplicationError(502, "ai_endpoint_request_failed", "Model request failed", "The selected endpoint rejected or failed the request. Confirm that it supports function calling.");
}
