import type { AiBuilderModelMessage } from "./ai-builder-contract.ts";
import type { AiBuilderModelClient } from "./ai-builder-workspace-client.ts";
import type { CallerIdentity } from "./contracts.ts";

/** Returns deterministic typed tool calls so local-test AI Builder can apply a proposal. */
export class LocalTestAiBuilderWorkspaceClient implements AiBuilderModelClient {
  async invoke(
    _caller: CallerIdentity,
    _endpointName: string,
    messages: AiBuilderModelMessage[],
    _signal: AbortSignal,
  ): Promise<Response> {
    const hasToolResults = messages.some((message) => message.role === "tool");
    if (hasToolResults) {
      return streamFrames([
        {
          choices: [{ delta: { content: "Added a local test title." } }],
        },
      ]);
    }

    return streamFrames([
      {
        choices: [{
          delta: {
            content: "I will add a local test title label.",
            tool_calls: [{
              index: 0,
              id: "local-add-label",
              function: {
                name: "addLabel",
                arguments: JSON.stringify({
                  text: "Local test title",
                  codeName: "localTestTitle",
                  fontSize: "medium",
                  bold: false,
                }),
              },
            }],
          },
        }],
      },
    ]);
  }
}

function streamFrames(payloads: unknown[]): Response {
  const frames = [
    ...payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`),
    "data: [DONE]\n\n",
  ];
  return new Response(frames.join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}
