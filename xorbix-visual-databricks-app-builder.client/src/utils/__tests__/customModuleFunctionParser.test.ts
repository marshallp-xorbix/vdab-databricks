import { describe, expect, it } from "vitest";
import { parseCustomModuleFunctionOptions } from "../workflow/customModuleFunctionParser";

describe("customModuleFunctionParser", () => {
  it("parses top-level function signatures for dropdown options", () => {
    const source = `
def example_handler(ctx):
    return {"ok": True}

def change_button_text(ctx):
    return {"ok": True}
`;

    const options = parseCustomModuleFunctionOptions(source);
    expect(options).toEqual([
      { functionName: "example_handler", signature: "example_handler(ctx)" },
      {
        functionName: "change_button_text",
        signature: "change_button_text(ctx)",
      },
    ]);
  });

  it("skips commented methods and supports leading whitespace before defs", () => {
    const source = `
# def commented_out(ctx):
#   return {}

    def live_function(ctx):
    return {}
`;

    const options = parseCustomModuleFunctionOptions(source);
    expect(options).toEqual([
      { functionName: "live_function", signature: "live_function(ctx)" },
    ]);
  });
});
