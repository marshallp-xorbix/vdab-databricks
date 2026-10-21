import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../src/application-error.ts";
import type { ProjectWorkflowDefinition } from "../src/db/project-workflow-contract.ts";
import { resolveWorkflowModuleFiles } from "../src/generation/preview-workflow-modules.ts";

test("PreviewWorkflowModules_RejectsRequiredPositionalAndKeywordArgumentsBeyondContext", () => {
  const invalidCases = [
    { functionName: "needs_extra", source: "def needs_extra(ctx, required):\n    return required\n" },
    { functionName: "needs_keyword", source: "def needs_keyword(ctx, *, required):\n    return required\n" },
  ];

  for (const invalidCase of invalidCases) {
    assert.throws(
      () => resolveWorkflowModuleFiles(
        createCustomModuleWorkflow(invalidCase.functionName),
        invalidCase.source,
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "preview_workflow_module_invalid",
    );
  }
});

test("PreviewWorkflowModules_AcceptsOptionalAndVariadicArgumentsBeyondContext", () => {
  const customModulesSource = [
    "def update_label(ctx, label: str = 'Ready, now', *values, **options):",
    "    return {'label': label, 'values': values, 'options': options}",
  ].join("\n");

  const files = resolveWorkflowModuleFiles(
    createCustomModuleWorkflow("update_label"),
    customModulesSource,
  );

  assert.equal(files.customModulesSource, `${customModulesSource}\n`);
});

test("PreviewWorkflowModules_AcceptsMultilineAnnotatedSignaturesBeforeGeneration", () => {
  const customModulesSource = [
    "def update_label(",
    "    ctx: object,",
    "    label: str = 'Ready, now',",
    ") -> str:",
    "    return label",
  ].join("\n");

  const files = resolveWorkflowModuleFiles(
    createCustomModuleWorkflow("update_label"),
    customModulesSource,
  );

  assert.equal(files.customModulesSource, `${customModulesSource}\n`);
});

test("PreviewWorkflowModules_RejectsRequiredExtraArgumentsInMultilineSignatures", () => {
  const customModulesSource = [
    "def update_label(",
    "    ctx: object,",
    "    required: str,",
    ") -> str:",
    "    return required",
  ].join("\n");

  assert.throws(
    () => resolveWorkflowModuleFiles(
      createCustomModuleWorkflow("update_label"),
      customModulesSource,
    ),
    (error: unknown) => error instanceof ApplicationError && error.code === "preview_workflow_module_invalid",
  );
});

test("PreviewWorkflowModules_RejectsIndentedAndDocstringDefinitions", () => {
  const customModulesSource = [
    '"""',
    "def update_label(ctx):",
    '"""',
    "def outer(ctx):",
    "    def update_label(ctx):",
    "        return ctx",
    "    return update_label(ctx)",
  ].join("\n");

  assert.throws(
    () => resolveWorkflowModuleFiles(
      createCustomModuleWorkflow("update_label"),
      customModulesSource,
    ),
    (error: unknown) => error instanceof ApplicationError && error.code === "preview_workflow_module_invalid",
  );
});

test("PreviewWorkflowModules_KeepsSingleContextArgumentCallAndInlineBody", () => {
  const customModulesSource = "def update_label(ctx): return ctx\n";

  const files = resolveWorkflowModuleFiles(
    createCustomModuleWorkflow("update_label"),
    customModulesSource,
  );

  assert.equal(files.customModulesSource, customModulesSource);
});

function createCustomModuleWorkflow(functionName: string): ProjectWorkflowDefinition {
  return {
    version: 1,
    workflows: [{
      codeName: "runCustom",
      trigger: { componentKey: "button-save", eventKey: "onClick" },
      nodes: [{
        id: "custom",
        actionType: "callCustomModule",
        schemaVersion: 1,
        params: { functionName },
      }],
      edges: [],
    }],
  };
}
