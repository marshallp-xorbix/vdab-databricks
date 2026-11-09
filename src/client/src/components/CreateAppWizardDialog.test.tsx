import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateAppWizardDialog from "./CreateAppWizardDialog";

const mockCreateProject = vi.fn();
const mockFetchNextPage = vi.fn();

vi.mock("../hooks/useWorkspaceApps", () => ({
  useWorkspaceApps: vi.fn(() => ({
    data: { pages: [{ items: [{ name: "existing-child", appState: "STOPPED" }] }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
    isFetchingNextPage: false,
  })),
}));

vi.mock("./ui/use-toast", () => ({ toast: vi.fn() }));

vi.mock("./ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      data-testid="wizard-native-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder ?? ""}</option>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function renderDialog() {
  const onOpenChange = vi.fn();
  render(
    <CreateAppWizardDialog
      open
      onOpenChange={onOpenChange}
      onProjectCreated={mockCreateProject}
    />,
  );
  return { onOpenChange };
}

describe("CreateAppWizardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProject.mockResolvedValue(undefined);
  });

  it("creates a project linked to an App in the installed workspace", async () => {
    const { onOpenChange } = renderDialog();

    expect(screen.getByText("This builder uses the workspace where it is installed.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("wizard-native-select"), {
      target: { value: "linkExisting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByTestId("wizard-native-select"), {
      target: { value: "existing-child" },
    });
    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Revenue dashboard" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Finance team" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create and link App" }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith("Revenue dashboard", "Finance team", {
        mode: "linkExisting",
        appName: "existing-child",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("validates a new Databricks App name before creating the project", async () => {
    renderDialog();
    fireEvent.change(screen.getByTestId("wizard-native-select"), {
      target: { value: "createNew" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("App name"), {
      target: { value: "Model app" },
    });
    fireEvent.change(screen.getByLabelText("New Databricks App name"), {
      target: { value: "Not Valid" },
    });

    const createButton = screen.getByRole("button", { name: "Create App" });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("New Databricks App name"), {
      target: { value: "model-app" },
    });
    expect(createButton).not.toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith("Model app", null, {
        mode: "createNew",
        appName: "model-app",
      });
    });
  });
});
