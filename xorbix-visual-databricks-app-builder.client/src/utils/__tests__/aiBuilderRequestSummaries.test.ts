import { describe, expect, it } from "vitest";
import {
  AI_BUILDER_MAX_CONVERSATION_MESSAGES,
  buildConversationHistory,
  mapWorkflowsToSummaries,
} from "../aiBuilderRequestSummaries";
import type { Workflow } from "../../types/workflow/workflowDefinition";

describe("aiBuilderRequestSummaries", () => {
  it("maps workflow node params without casting", () => {
    const workflows: Workflow[] = [
      {
        codeName: "refreshOrders",
        trigger: { componentCodeName: "refreshButton", eventKey: "onClick" },
        nodes: [
          {
            id: "toast1",
            actionType: "TriggerToast",
            schemaVersion: 1,
            params: { body: "Saved", duration: { kind: "preset", value: "short" } },
          },
        ],
        edges: [],
      },
    ];

    const summaries = mapWorkflowsToSummaries(workflows);

    expect(summaries[0].nodes[0].params?.body).toBe("Saved");
  });

  it("caps conversation history at the shared limit", () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      sender: index % 2 === 0 ? ("user" as const) : ("bot" as const),
      text: `message-${index}`,
    }));

    const history = buildConversationHistory(messages);

    expect(history).toHaveLength(AI_BUILDER_MAX_CONVERSATION_MESSAGES);
    expect(history[0].content).toBe("message-5");
  });
});
