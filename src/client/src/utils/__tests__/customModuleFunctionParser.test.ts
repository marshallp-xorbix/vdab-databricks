import { describe, expect, it } from "vitest";
import { parseCustomModuleFunctionOptions } from "../workflow/customModuleFunctionParser";

describe("customModuleFunctionParser", () => {
  it("parses only top-level functions callable with the workflow context", () => {
    const source = `
def example_handler(ctx):
    return {"ok": True}

def change_button_text(ctx: object, label: str = "Ready") -> dict[str, str]:
    return {"ok": True}

def needs_argument(ctx, required):
    return required

def outer(ctx):
    def nested(ctx):
        return ctx
    return nested(ctx)
`;

    const options = parseCustomModuleFunctionOptions(source);
    expect(options).toEqual([
      { functionName: "example_handler", signature: "example_handler(ctx)" },
      { functionName: "change_button_text", signature: 'change_button_text(ctx: object, label: str = "Ready")' },
      { functionName: "outer", signature: "outer(ctx)" },
    ]);
  });

  it("ignores commented, indented, and docstring-contained definitions", () => {
    const source = `
# def commented_out(ctx):
#   return {}

"""
def docstring_function(ctx):
    return {}
"""

    def nested_function(ctx):
        return {}
`;

    const options = parseCustomModuleFunctionOptions(source);
    expect(options).toEqual([]);
  });

  it("parses multiline signatures with nested annotations and return types", () => {
    const source = `
def transform(
    ctx: object,
    options: dict[str, list[int]] = {"limits": [1, 2]},
) -> tuple[str, int]:
    return "ok", 1
`;

    expect(parseCustomModuleFunctionOptions(source)).toEqual([
      {
        functionName: "transform",
        signature: 'transform(ctx: object, options: dict[str, list[int]] = {"limits": [1, 2]})',
      },
    ]);
  });
});
