import type { AiBuilderModelClient } from "./ai-builder-workspace-client.ts";
import type { CallerIdentity } from "./contracts.ts";

const LOCAL_TEST_TITLE = {
  key: "local-test-title",
  type: "Label",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "localTestTitle",
  description: null,
  properties: { text: "Local test title", fontSize: "medium", bold: false },
  bindings: null,
  children: [],
  layout: null,
};

/** Returns a deterministic tool call so local-test AI Builder can apply a proposal. */
export class LocalTestAiBuilderWorkspaceClient implements AiBuilderModelClient {
  async invoke(
    _caller: CallerIdentity,
    _endpointName: string,
    _messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    _signal: AbortSignal,
  ): Promise<Response> {
    const argumentsJson = JSON.stringify({
      assistantMessage: "Added a local test title.",
      operationsJson: JSON.stringify([{ type: "addComponent", component: LOCAL_TEST_TITLE }]),
    });
    const payload = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { name: "apply_project_operations", arguments: argumentsJson },
          }],
        },
      }],
    });
    return new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, {
      headers: { "content-type": "text/event-stream" },
    });
  }
}
