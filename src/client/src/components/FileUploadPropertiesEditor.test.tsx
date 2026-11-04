import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceCatalogs,
  listWorkspaceSchemas,
  listWorkspaceVolumes,
} from "../api/workspaceResourcesApi";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import FileUploadPropertiesEditor from "./FileUploadPropertiesEditor";
import { validateVolumeFolder } from "../utils/projectFileUploadBinding";

vi.mock("../api/workspaceResourcesApi", () => ({
  listWorkspaceCatalogs: vi.fn(),
  listWorkspaceSchemas: vi.fn(),
  listWorkspaceVolumes: vi.fn(),
}));

const listWorkspaceCatalogsMock = vi.mocked(listWorkspaceCatalogs);
const listWorkspaceSchemasMock = vi.mocked(listWorkspaceSchemas);
const listWorkspaceVolumesMock = vi.mocked(listWorkspaceVolumes);

beforeEach(() => {
  listWorkspaceCatalogsMock.mockResolvedValue({
    items: [{ name: "main" }],
    authenticationMode: "databricks",
  });
  listWorkspaceSchemasMock.mockResolvedValue({
    items: [{ name: "landing" }],
    authenticationMode: "databricks",
  });
  listWorkspaceVolumesMock.mockResolvedValue({
    items: [{ name: "incoming" }],
    authenticationMode: "databricks",
  });
});

describe("FileUploadPropertiesEditor", () => {
  it("edits the label and explains the in-memory upload behavior", () => {
    const onPropertiesChange = vi.fn<(properties: ProjectJsonObject) => void>();
    renderEditor(onPropertiesChange, vi.fn());

    fireEvent.change(screen.getByLabelText("Label"), {
      target: { value: "Upload invoices" },
    });
    expect(onPropertiesChange).toHaveBeenCalledWith({ label: "Upload invoices" });
    expect(screen.getByText(/current viewer’s Databricks permissions/)).toBeInTheDocument();
    expect(screen.getByText(/Multiple files are accepted/)).toBeInTheDocument();
  });

  it("keeps inaccessible saved resource names visible and reports unsafe folders", () => {
    const savedBindings: ProjectJsonObject = {
      databricksVolume: {
        bindingType: "databricksVolume",
        source: {
          kind: "resource",
          valueType: "file",
          resource: {
            type: "databricksVolume",
            catalog: "retired_catalog",
            schema: "legacy_schema",
            volume: "old_volume",
            filePath: "../escape",
          },
        },
      },
    };
    renderEditor(vi.fn(), vi.fn(), savedBindings);

    expect(screen.getByRole("option", { name: "retired_catalog" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "legacy_schema" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "old_volume" })).toBeInTheDocument();
    expect(screen.getByText(/parent directory segments/)).toBeInTheDocument();
    expect(validateVolumeFolder("/absolute")).not.toBeNull();
    expect(validateVolumeFolder("safe/path")).toBeNull();
  });

  it("shows a resource permission error instead of an empty-resource state", async () => {
    listWorkspaceCatalogsMock.mockRejectedValueOnce(
      new Error("Workspace resource access is not available"),
    );
    renderEditor(vi.fn(), vi.fn());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workspace resource access is not available",
    );
    expect(screen.queryByText("No catalogs are visible to this user.")).toBeNull();
  });
});

function renderEditor(
  onPropertiesChange: (properties: ProjectJsonObject) => void,
  onBindingsChange: (bindings: ProjectJsonObject | null) => void,
  bindings: ProjectJsonObject | null = null,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FileUploadEditorHarness
        initialBindings={bindings}
        onPropertiesChange={onPropertiesChange}
        onBindingsChange={onBindingsChange}
      />
    </QueryClientProvider>,
  );
}

interface IFileUploadEditorHarnessProps {
  initialBindings: ProjectJsonObject | null;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function FileUploadEditorHarness({
  initialBindings,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IFileUploadEditorHarnessProps>) {
  const [bindings, setBindings] = useState(initialBindings);

  return (
    <FileUploadPropertiesEditor
      componentKey="files"
      properties={{ label: "Upload files" }}
      bindings={bindings}
      disabled={false}
      onPropertiesChange={onPropertiesChange}
      onBindingsChange={(nextBindings) => {
        setBindings(nextBindings);
        onBindingsChange(nextBindings);
      }}
    />
  );
}
