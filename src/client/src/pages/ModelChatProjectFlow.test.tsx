import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getProjectComponentsMock,
  replaceProjectComponentsMock,
  generateProjectPreviewMock,
  renderProjectEditorPage,
  createEditorFetch,
  initializeProjectEditorTestState,
  resetProjectEditorTestState,
  project,
} from "./ProjectEditorPage.test-support";

afterEach(resetProjectEditorTestState);
beforeEach(() => {
  initializeProjectEditorTestState();
  getProjectComponentsMock.mockResolvedValue({
    projectId: project.id,
    version: 1,
    components: [],
  });
  replaceProjectComponentsMock.mockImplementation(async (input) => ({
    projectId: input.projectId,
    version: input.version + 1,
    components: input.components,
  }));
  generateProjectPreviewMock.mockResolvedValue({
    projectId: project.id,
    version: 2,
    previewOnly: true,
    files: [{ path: "app.py", content: "_vdab_render_model_chat('modelChat1')" }],
  });
  vi.stubGlobal(
    "fetch",
    createEditorFetch(undefined, {
      childApp: {
        appId: "app-1",
        appName: "model-chat-app",
        mode: "createNew",
        sourceCodePath: "/Workspace/Users/user/apps/model-chat-app",
      },
      appResources: [
        {
          name: "chat-endpoint",
          description: "Support chat",
          serving_endpoint: {
            name: "support-chat",
            permission: "CAN_QUERY",
          },
        },
      ],
    }),
  );
});

describe("ModelChat standalone project flow", () => {
  it("adds, selects, configures, saves, and previews a serving endpoint App resource", async () => {
    const user = userEvent.setup();
    await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Model Chat" }));
    await user.selectOptions(
      await screen.findByLabelText("Serving endpoint app resource"),
      "chat-endpoint",
    );
    await user.clear(screen.getByLabelText("Chat title"));
    await user.type(screen.getByLabelText("Chat title"), "Support questions");
    await user.clear(screen.getByLabelText("Chat height (px)"));
    await user.type(screen.getByLabelText("Chat height (px)"), "720");
    await user.click(screen.getByLabelText("Show chat border"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const saved = replaceProjectComponentsMock.mock.calls.at(-1)?.[0].components;
    expect(saved).toHaveLength(1);
    expect(saved?.[0]).toMatchObject({
      type: "ModelChat",
      properties: {
        servingEndpointAppResourceName: "chat-endpoint",
        title: "Support questions",
        showBorder: true,
        chatTotalHeightPixels: 720,
      },
      bindings: null,
      children: [],
      layout: null,
    });
    expect(saved?.[0]?.properties).not.toHaveProperty("servingEndpointName");
    expect(JSON.stringify(saved)).not.toMatch(/workspaceHost|workspaceUrl|accessToken/);

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent(
      "_vdab_render_model_chat",
    );
    expect(generateProjectPreviewMock).toHaveBeenCalled();
  }, 60_000);
});
