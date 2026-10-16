import { describe, expect, it } from "vitest";
import {
  getAiBuilderResponseMessage,
  shouldApplyAiBuilderOperations,
} from "../aiBuilderResponseMessages";

describe("aiBuilderResponseMessages", () => {
  it("does not apply operations for unable or clarification statuses", () => {
    expect(
      shouldApplyAiBuilderOperations({
        status: "unableToComplete",
        operations: [{ op: "add" }],
        explanation: "",
      }),
    ).toBe(false);

    expect(
      shouldApplyAiBuilderOperations({
        status: "needsClarification",
        operations: [],
        explanation: "",
      }),
    ).toBe(false);
  });

  it("applies operations for partial and completed statuses", () => {
    expect(
      shouldApplyAiBuilderOperations({
        status: "partial",
        operations: [{ op: "add" }],
        explanation: "",
      }),
    ).toBe(true);
  });

  it("prefers structured reason messages", () => {
    const message = getAiBuilderResponseMessage({
      status: "partial",
      operations: [{ op: "add" }],
      explanation: "fallback",
      reason: {
        code: "tooComplex",
        title: "Partial",
        message: "Completed the form only.",
      },
    });

    expect(message).toBe("Completed the form only.");
  });
});
