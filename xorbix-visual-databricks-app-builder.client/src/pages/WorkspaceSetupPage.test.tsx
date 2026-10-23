import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceSession } from "../api/workspaceSessionApi";
import { getWorkspaceSetupDiagnostics } from "../api/workspaceSetupDiagnosticsApi";
import type { IWorkspaceSession } from "../models/WorkspaceSession";
import { WorkspaceSetupDiagnostics } from "../models/WorkspaceSetupDiagnostics";
import WorkspaceSetupPage from "./WorkspaceSetupPage";

vi.mock("../api/workspaceSessionApi", () => ({
  getWorkspaceSession: vi.fn(),
}));

vi.mock("../api/workspaceSetupDiagnosticsApi", () => ({
  getWorkspaceSetupDiagnostics: vi.fn(),
}));

const getWorkspaceSessionMock = vi.mocked(getWorkspaceSession);
const getWorkspaceSetupDiagnosticsMock = vi.mocked(
  getWorkspaceSetupDiagnostics,
);

function createPageWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return function PageWrapper({ children }: Readonly<PropsWithChildren>) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

function makeSession(
  overrides: Partial<IWorkspaceSession> = {},
): IWorkspaceSession {
  return {
    userId: "user-123",
    preferredUsername: "Taylor User",
    email: "taylor@example.com",
    workspace: {
      id: "workspace-456",
      host: "https://workspace.example.com",
    },
    authenticationMode: "databricks",
    installationAdmin: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

function makeSetupDiagnostics() {
  return new WorkspaceSetupDiagnostics({
    lakebase: {
      status: "configured",
      configuredFields: [
        "LAKEBASE_ENDPOINT",
        "PGHOST",
        "PGPORT",
        "PGDATABASE",
        "PGUSER",
        "PGSSLMODE",
      ],
      missingFields: [],
      message: "Configuration present. Connectivity is not verified.",
    },
    defaultSqlWarehouse: {
      status: "missing",
      message: "No workspace default is configured.",
    },
    authorization: {
      status: "missing-scopes",
      requestedScopes: ["apps", "sql"],
      effectiveScopes: ["apps", "sql"],
      consentedScopes: ["apps"],
      missingScopes: ["sql"],
      message: "Grant consent in Databricks.",
    },
  });
}

describe("WorkspaceSetupPage", () => {
  it("shows an accessible pending state while session information loads", () => {
    getWorkspaceSessionMock.mockReturnValueOnce(new Promise(() => undefined));

    render(<WorkspaceSetupPage />, { wrapper: createPageWrapper() });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking the installed workspace session",
    );
  });

  it("shows user, workspace, and setup guidance without credentials", async () => {
    getWorkspaceSessionMock.mockResolvedValueOnce(makeSession());

    render(<WorkspaceSetupPage />, { wrapper: createPageWrapper() });

    expect(
      await screen.findByRole("heading", {
        name: "Installed workspace session",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Taylor User")).toBeInTheDocument();
    expect(
      screen.getByText("https://workspace.example.com"),
    ).toBeInTheDocument();
    expect(screen.getByText("workspace-456")).toBeInTheDocument();
    expect(
      screen.getByText("Not configured for this user"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Resource and permission setup" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("user-access-token")).not.toBeInTheDocument();
  });

  it("identifies simulated local-test identity without implying workspace proof", async () => {
    getWorkspaceSessionMock.mockResolvedValueOnce(
      makeSession({ authenticationMode: "local-test" }),
    );

    render(<WorkspaceSetupPage />, { wrapper: createPageWrapper() });

    expect(
      await screen.findByText(
        /This does not verify Databricks sign-in or resource access/,
      ),
    ).toBeInTheDocument();
  });

  it("runs diagnostics only after user action and shows missing consent", async () => {
    getWorkspaceSessionMock.mockResolvedValueOnce(makeSession());
    getWorkspaceSetupDiagnosticsMock.mockResolvedValueOnce(
      makeSetupDiagnostics(),
    );

    render(<WorkspaceSetupPage />, { wrapper: createPageWrapper() });

    expect(
      await screen.findByRole("heading", { name: "Setup diagnostics" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Not checked/);
    expect(getWorkspaceSetupDiagnosticsMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Check workspace setup" }),
    );

    const missingConsentLabel = await screen.findByText(/Missing consent/);
    expect(missingConsentLabel.parentElement).toHaveTextContent("sql");
    expect(
      screen.getByText(/Connectivity is not verified/),
    ).toBeInTheDocument();
    expect(getWorkspaceSetupDiagnosticsMock).toHaveBeenCalledTimes(1);
  });

  it("shows actionable session errors", async () => {
    getWorkspaceSessionMock.mockRejectedValueOnce(
      new Error("Open VDAB through Databricks."),
    );

    render(<WorkspaceSetupPage />, { wrapper: createPageWrapper() });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Open VDAB through Databricks.",
    );
  });
});
