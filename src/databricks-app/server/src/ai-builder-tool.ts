/** OpenAI-compatible tool name shared by the stream parser and request builder. */
export const AI_BUILDER_TOOL_NAME = "apply_project_operations";

/** Shallow tool schema keeps model output focused on the changed project records. */
export const AI_BUILDER_TOOLS = [
  {
    type: "function",
    function: {
      name: AI_BUILDER_TOOL_NAME,
      description: "Return a compact ordered JSON array of operations for the requested VDAB project edits. Stream a short plan in ordinary assistant text first. The server applies operations to the current snapshot and validates the complete result. Preserve every untouched record. For large requests, return a coherent partial slice rather than every change.",
      parameters: {
        type: "object",
        properties: {
          assistantMessage: {
            type: "string",
            description: "Summarize what changed and, for partial outcomes, what remains.",
          },
          operationsJson: {
            type: "string",
            description: "A JSON array with 1 to 100 operations. Supported types: addComponent {component}; replaceComponent {key, component}; deleteComponent {key}; reorderComponents {keys}; upsertWorkflow {workflow}; deleteWorkflow {codeName}; replaceCustomModulesSource {source}. Send only changed records, and do not return a complete project snapshot. Never addComponent with an existing key; never delete or replace a missing key; keep workflow triggers and routes consistent with remaining components.",
          },
          outcome: {
            type: "string",
            enum: ["completed", "partial"],
            description: "Use partial when only a coherent subset of a larger request was applied.",
          },
        },
        required: ["assistantMessage", "operationsJson"],
      },
    },
  },
] as const;
