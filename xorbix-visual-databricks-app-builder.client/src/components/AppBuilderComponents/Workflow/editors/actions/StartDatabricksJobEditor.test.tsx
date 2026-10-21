import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Workflow } from "../../../../../types/workflow";
import type { StartDatabricksJobNode } from "../../../../../types/workflow/actionNode";
import type { WorkflowActionEditorProps } from "./types";
import StartDatabricksJobEditor from "./StartDatabricksJobEditor";

vi.mock("../../../../../hooks/useWorkspaceJobs", () => ({
  useWorkspaceJobs: () => ({
    data: {
      items: [{ jobId: "12345", name: "Refresh orders" }],
      authenticationMode: "local-test",
    },
    error: null,
    isError: false,
    isPending: false,
  }),
}));

describe("StartDatabricksJobEditor", () => {
  it("selects a job visible in the installed workspace and explains its Run as identity", async () => {
    const user = userEvent.setup();
    const node: StartDatabricksJobNode = {
      id: "start-refresh",
      actionType: "StartDatabricksJob",
      schemaVersion: 1,
      params: {
        job: {
          resourceType: "databricksJob",
          workspaceConnectionId: 0,
          jobId: "",
          jobName: "",
        },
      },
    };
    const workflow: Workflow = {
      codeName: "refreshOrders",
      trigger: { componentCodeName: "refreshButton", eventKey: "onClick" },
      nodes: [node],
      edges: [],
    };
    const onUpdateNode = vi.fn<WorkflowActionEditorProps["onUpdateNode"]>();

    render(
      <StartDatabricksJobEditor
        workflowId="refreshOrders"
        workflow={workflow}
        node={node}
        components={[]}
        onUpdateNode={onUpdateNode}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Refresh orders" }));

    await waitFor(() => expect(onUpdateNode).toHaveBeenCalledTimes(1));
    const update = onUpdateNode.mock.calls[0]?.[2];
    expect(update?.(node)).toMatchObject({
      params: {
        job: {
          jobId: "12345",
          jobName: "Refresh orders",
        },
      },
    });
    expect(screen.getByText(/configured Run as identity/i)).toBeInTheDocument();
  });
});
