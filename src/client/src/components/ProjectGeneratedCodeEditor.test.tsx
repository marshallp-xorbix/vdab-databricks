import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectGeneratedCodeEditor from "./ProjectGeneratedCodeEditor";
import { getProjectCustomModules, replaceProjectCustomModules } from "../api/projectCustomModulesApi";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
    options: { ariaLabel?: string; readOnly?: boolean };
  }) => (
    <textarea
      aria-label={options.ariaLabel ?? "Editor content"}
      value={value}
      readOnly={options.readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("../api/projectCustomModulesApi", () => ({
  getProjectCustomModules: vi.fn(),
  replaceProjectCustomModules: vi.fn(),
}));

const getProjectCustomModulesMock = vi.mocked(getProjectCustomModules);
const replaceProjectCustomModulesMock = vi.mocked(replaceProjectCustomModules);

describe("ProjectGeneratedCodeEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectCustomModulesMock.mockResolvedValue({
      projectId: "project-1",
      version: 1,
      source: "# custom modules\n",
    });
    replaceProjectCustomModulesMock.mockResolvedValue({
      projectId: "project-1",
      version: 2,
      source: "def normalize_order(ctx):\n    return {'ok': True}\n",
    });
  });

  it("marks custom module source dirty after an edit", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    let source = "# custom modules\n";
    function renderEditor(): ReactElement {
      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ProjectGeneratedCodeEditor
              projectId="project-1"
              preview={{
                projectId: "project-1",
                version: 1,
                previewOnly: true,
                files: [{ path: "app.py", content: "import streamlit as st\n" }],
              }}
              isPending={false}
              errorMessage={null}
              isDisabled={false}
              onGenerate={vi.fn()}
              onCustomModulesDirtyChange={vi.fn()}
              customModulesSource={source}
              hasLoadedCustomModulesSource
              onCustomModulesSourceChange={onSourceChange}
            />
          </ThemeProvider>
        </QueryClientProvider>
      );
    }
    const onSourceChange = vi.fn((next: string) => {
      source = next;
      rerender(renderEditor());
    });

    const { rerender } = render(renderEditor());

    fireEvent.click(await screen.findByRole("button", { name: "custom_modules.py" }));
    const editor = await screen.findByLabelText("Custom Python module source");
    await waitFor(() => expect(editor).not.toHaveAttribute("readonly"));
    fireEvent.change(editor, {
      target: { value: "def normalize_order(ctx):\n    return {'ok': True}\n" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save custom modules" })).toBeEnabled(),
    );
    expect(onSourceChange).toHaveBeenCalled();
  });
});
