import { describe, expect, it } from "vitest";
import { parsePrebuiltModuleFunctionOptions } from "../parsePrebuiltModuleFunctionOptions";

describe("parsePrebuiltModuleFunctionOptions", () => {
  it("includes functions whose first parameter is ctx and lists following params", () => {
    const source = `
def change_text(ctx, component, new_label):
    pass

def nope(a, b):
    pass
`;

    const options = parsePrebuiltModuleFunctionOptions(source);
    expect(options).toEqual([
      {
        functionName: "change_text",
        signature: "change_text(ctx, component, new_label)",
        parameterNames: ["component", "new_label"],
      },
    ]);
  });

  it("includes ctx-only functions", () => {
    const source = `def reset_ui(ctx):
    pass
`;
    expect(parsePrebuiltModuleFunctionOptions(source)).toEqual([
      {
        functionName: "reset_ui",
        signature: "reset_ui(ctx)",
        parameterNames: [],
      },
    ]);
  });

  it("skips defs whose first parameter is not ctx", () => {
    const source = `def bad_first(self, ctx):
    pass
`;
    expect(parsePrebuiltModuleFunctionOptions(source)).toEqual([]);
  });
});
