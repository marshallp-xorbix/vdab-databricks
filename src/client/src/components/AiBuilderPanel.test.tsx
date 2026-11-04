import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiBuilderPanel from "./AiBuilderPanel";
import type { IAiBuilderProposal } from "../models/AiBuilder";
import type { IWorkspaceServingEndpoint } from "../models/WorkspaceServingEndpoint";

afterEach(() => vi.unstubAllGlobals());

describe("AiBuilderPanel", () => {
  it("starts a fresh conversation and closes from the header controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithQueryClient(
      <AiBuilderPanel
        projectId="project-one"
        version={4}
        endpoints={endpoints}
        components={[]}
        workflow={{ version: 1, workflows: [] }}
        customModulesSource=""
        initialHistory={[{ role: "user", content: "Create a form" }]}
        onClose={onClose}
        onApplyProposal={vi.fn()}
      />,
    );

    expect(screen.getByText("Create a form")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByText("Create a form")).not.toBeInTheDocument();
    expect(screen.getByText(/Describe the app you want to build/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close AI Builder" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("filters endpoint choices, shows progress and lets the user apply a proposal to the draft", async () => {
    const user = userEvent.setup();
    const onApplyProposal = vi.fn();
    const responseController = createDeferredStreamResponse();
    const fetchMock = vi.fn().mockResolvedValue(responseController.response);
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <AiBuilderPanel
        projectId="project-one"
        version={4}
        endpoints={endpoints}
        components={[]}
        workflow={{ version: 1, workflows: [] }}
        customModulesSource="# modules"
        initialHistory={[
          { role: "user", content: "Create a form" },
          { role: "assistant", content: "What fields should it include?" },
        ]}
        onApplyProposal={onApplyProposal}
      />,
    );

    const endpointSelect = screen.getByRole("combobox", { name: "Serving endpoint" });
    expect(Array.from((endpointSelect as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      "",
      "builder-model",
      "manageable-model",
    ]);
    expect((endpointSelect as HTMLSelectElement).value).toBe("builder-model");

    await user.type(screen.getByRole("textbox", { name: "What would you like to change?" }), "Add a save button");
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));

    expect(await screen.findByText("Drafting a proposal")).toBeInTheDocument();
    const [, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestOptions.body))).toEqual({
      version: 4,
      endpointName: "builder-model",
      prompt: "Add a save button",
      history: [
        { role: "user", content: "Create a form" },
        { role: "assistant", content: "What fields should it include?" },
      ],
      components: [],
      workflow: { version: 1, workflows: [] },
      customModulesSource: "# modules",
    });

    responseController.complete();
    expect(await screen.findByText("Added a save button.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply proposal to draft" }));

    await waitFor(() => {
      expect(onApplyProposal).toHaveBeenCalledWith(proposal, 4);
    });
    expect(screen.getByRole("button", { name: "Applied to draft" })).toBeDisabled();
  });

  it("explains when no ready queryable endpoint is available and hides apply for text-only responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse({
      assistantMessage: "Which control should the form contain?",
      proposal: null,
      version: 2,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    const emptyEndpointPanel = renderWithQueryClient(
      <AiBuilderPanel
        projectId="project-one"
        version={2}
        endpoints={endpoints.filter((endpoint) =>
          endpoint.permissionLevel !== "CAN_QUERY" && endpoint.permissionLevel !== "CAN_MANAGE")}
        components={[]}
        workflow={{ version: 1, workflows: [] }}
        customModulesSource=""
        onApplyProposal={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No ready serving endpoints with query access are available.");
    expect(screen.getByRole("button", { name: "Generate suggestion" })).toBeDisabled();
    emptyEndpointPanel.unmount();

    const rerenderHarness = renderWithQueryClient(
      <AiBuilderPanel
        projectId="project-two"
        version={2}
        endpoints={[endpoints[2]!]}
        components={[]}
        workflow={{ version: 1, workflows: [] }}
        customModulesSource=""
        onApplyProposal={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/What would you like to change/), "Help me plan a form");
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));
    expect(await screen.findByText("Which control should the form contain?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply proposal to draft" })).not.toBeInTheDocument();
    rerenderHarness.unmount();
  });

  it("rejects applying a proposal after the project version changes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse({
      assistantMessage: "Here is a current proposal.",
      proposal,
      version: 4,
    })));
    const onApplyProposal = vi.fn();

    renderWithQueryClient(
      <AiBuilderPanel
        projectId="project-one"
        version={5}
        endpoints={[endpoints[2]!]}
        components={[]}
        workflow={{ version: 1, workflows: [] }}
        customModulesSource=""
        onApplyProposal={onApplyProposal}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "What would you like to change?" }), "Add a button");
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));
    await user.click(await screen.findByRole("button", { name: "Apply proposal to draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The project changed after this suggestion.");
    expect(onApplyProposal).not.toHaveBeenCalled();
  });

  it("rejects applying a proposal after the editable draft changes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse({
      assistantMessage: "Here is a proposal.",
      proposal,
      version: 4,
    })));
    const onApplyProposal = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const initialComponents: IAiBuilderProposal["components"] = [];
    const rendered = render(
      <QueryClientProvider client={queryClient}>
        <AiBuilderPanel
          projectId="project-one"
          version={4}
          endpoints={[endpoints[2]!]}
          components={initialComponents}
          workflow={{ version: 1, workflows: [] }}
          customModulesSource="# modules"
          onApplyProposal={onApplyProposal}
        />
      </QueryClientProvider>,
    );
    await user.type(screen.getByRole("textbox", { name: "What would you like to change?" }), "Add a button");
    await user.click(screen.getByRole("button", { name: "Generate suggestion" }));

    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <AiBuilderPanel
          projectId="project-one"
          version={4}
          endpoints={[endpoints[2]!]}
          components={proposal.components}
          workflow={{ version: 1, workflows: [] }}
          customModulesSource="# modules"
          onApplyProposal={onApplyProposal}
        />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Apply proposal to draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("editable project changed");
    expect(onApplyProposal).not.toHaveBeenCalled();
  });
});

const endpoints: IWorkspaceServingEndpoint[] = [
  { name: "warming-model", readiness: "not-ready", permissionLevel: "CAN_QUERY" },
  { name: "visible-only-model", readiness: "ready", permissionLevel: "CAN_VIEW" },
  { name: "builder-model", readiness: "ready", permissionLevel: "CAN_QUERY" },
  { name: "manageable-model", readiness: "ready", permissionLevel: "CAN_MANAGE" },
  { name: "embedding-model", task: "llm/v1/embeddings", readiness: "ready", permissionLevel: "CAN_QUERY" },
];

const proposal: IAiBuilderProposal = {
  components: [{
    key: "save-button",
    type: "Button",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: "saveButton",
    description: null,
    properties: { label: "Save" },
    bindings: null,
    children: [],
    layout: null,
  }],
  workflow: { version: 1, workflows: [] },
  customModulesSource: "# modules\n",
};

function renderWithQueryClient(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

function sseResponse(result: unknown): Response {
  return new Response(`event: result\ndata: ${JSON.stringify(result)}\n\n`, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function createDeferredStreamResponse(): { response: Response; complete: () => void } {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      controller.enqueue(encoder.encode("event: progress\ndata: {\"message\":\"Drafting a proposal\"}\n\n"));
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
  return {
    response,
    complete: () => {
      streamController?.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify({
        assistantMessage: "Added a save button.",
        proposal,
        version: 4,
      })}\n\n`));
      streamController?.close();
    },
  };
}

