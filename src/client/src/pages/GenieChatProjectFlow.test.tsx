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
  let savedVersion = 1;
  replaceProjectComponentsMock.mockImplementation(async (input) => {
    savedVersion = input.version + 1;
    return {
      projectId: input.projectId,
      version: savedVersion,
      components: input.components,
    };
  });
  generateProjectPreviewMock.mockResolvedValue({
    projectId: project.id,
    version: 2,
    previewOnly: true,
    files: [{ path: "app.py", content: "_vdab_render_genie_chat('genieChat1')" }],
  });
  vi.stubGlobal(
    "fetch",
    createEditorFetch(undefined, {
      childApp: {
        appId: "app-1",
        appName: "revenue-genie-app",
        mode: "createNew",
        sourceCodePath: "/Workspace/Users/user/apps/revenue-genie-app",
      },
      appResources: [
        {
          name: "sales-genie",
          description: "Sales Genie",
          genie_space: {
            name: "Revenue Genie",
            space_id: "0123456789abcdef0123456789abcdef",
            permission: "CAN_RUN",
          },
        },
      ],
    }),
  );
});

describe("GenieChat standalone project flow", () => {
  it("adds, selects, configures, saves, and previews a Genie space App resource", async () => {
    const user = userEvent.setup();
    await renderProjectEditorPage();

    await user.click(await screen.findByRole("button", { name: "Add Genie Chat" }));
    await user.selectOptions(
      await screen.findByLabelText("Genie space app resource"),
      "sales-genie",
    );
    await user.clear(screen.getByLabelText("Chat title"));
    await user.type(screen.getByLabelText("Chat title"), "Revenue questions");
    await user.clear(screen.getByLabelText("Chat height (px)"));
    await user.type(screen.getByLabelText("Chat height (px)"), "720");
    await user.click(screen.getByLabelText("Show chat border"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replaceProjectComponentsMock).toHaveBeenCalled());
    const saved = replaceProjectComponentsMock.mock.calls.at(-1)?.[0].components;
    expect(saved).toHaveLength(1);
    expect(saved?.[0]).toMatchObject({
      type: "GenieChat",
      properties: {
        genieSpaceAppResourceName: "sales-genie",
        title: "Revenue questions",
        showBorder: true,
        chatTotalHeightPixels: 720,
      },
      bindings: null,
      children: [],
      layout: null,
    });
    expect(saved?.[0]?.properties).not.toHaveProperty("genieSpaceId");
    expect(JSON.stringify(saved)).not.toMatch(/workspaceHost|workspaceUrl|accessToken/);

    await user.click(screen.getAllByRole("link", { name: "Code" })[0]!);
    expect(await screen.findByLabelText("Generated app code")).toHaveTextContent(
      "_vdab_render_genie_chat",
    );
    expect(generateProjectPreviewMock).toHaveBeenCalled();
  }, 60_000);
});
