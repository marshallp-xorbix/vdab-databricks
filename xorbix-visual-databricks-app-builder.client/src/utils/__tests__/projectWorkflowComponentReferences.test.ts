import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../../models/ProjectComponents";
import type { IProjectWorkflowDefinition } from "../../models/ProjectWorkflow";
import { removeWorkflowsForProjectComponents } from "../projectWorkflowComponentReferences";

function createWorkflow(
  codeName: string,
  componentKey: string,
  nodes: IProjectWorkflowDefinition["workflows"][number]["nodes"] = [],
): IProjectWorkflowDefinition["workflows"][number] {
  return {
    codeName,
    trigger: { componentKey, eventKey: "onClick" },
    nodes,
    edges: [],
  };
}

describe("removeWorkflowsForProjectComponents", () => {
  it("removes workflows triggered by or referencing a deleted component", () => {
    const workflow: IProjectWorkflowDefinition = {
      version: 1,
      workflows: [
        createWorkflow("triggered-flow", "button-key"),
        createWorkflow("binding-flow", "keep-key", [
          {
            id: "binding-node",
            actionType: "setBinding",
            schemaVersion: 1,
            params: { target: { componentCodeName: "button1" } },
          },
        ]),
        createWorkflow("unrelated-flow", "keep-key"),
      ],
    };
    const removedComponents: IProjectComponent[] = [
      {
        key: "button-key",
        type: "Button",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "button1",
        description: null,
        properties: {},
        bindings: null,
        children: [],
        layout: null,
      },
    ];

    const updated = removeWorkflowsForProjectComponents(
      workflow,
      removedComponents,
    );

    expect(updated.workflows.map((candidate) => candidate.codeName)).toEqual([
      "unrelated-flow",
    ]);
  });

  it("keeps workflow references when no removed component matches", () => {
    const workflow: IProjectWorkflowDefinition = {
      version: 1,
      workflows: [createWorkflow("keep-flow", "keep-key")],
    };

    expect(removeWorkflowsForProjectComponents(workflow, [])).toBe(workflow);
  });
});
