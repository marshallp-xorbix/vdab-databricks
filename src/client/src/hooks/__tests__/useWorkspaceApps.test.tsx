import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceAppsPage } from "../../models/WorkspaceApp";
import { listWorkspaceApps } from "../../api/workspaceAppsApi";
import { useWorkspaceApps, workspaceAppKeys } from "../useWorkspaceApps";

vi.mock("../../api/workspaceAppsApi", () => ({
  listWorkspaceApps: vi.fn(),
}));

const listWorkspaceAppsMock = vi.mocked(listWorkspaceApps);

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function QueryWrapper({
    children,
  }: Readonly<PropsWithChildren>) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makePage(overrides: Partial<IWorkspaceAppsPage> = {}): IWorkspaceAppsPage {
  return {
    items: [],
    nextPageToken: null,
    authenticationMode: "databricks",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useWorkspaceApps", () => {
  it("loads the first page under the workspace apps query key", async () => {
    const page = makePage({ nextPageToken: "next-page" });
    listWorkspaceAppsMock.mockResolvedValueOnce(page);

    const { result } = renderHook(() => useWorkspaceApps(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pages).toEqual([page]);
    expect(listWorkspaceAppsMock).toHaveBeenCalledWith(null, expect.anything());
    expect(workspaceAppKeys.lists()).toEqual(["workspace-apps", "list"]);
  });

  it("follows a continuation token when another page is requested", async () => {
    const firstPage = makePage({
      items: [
        {
          name: "first-app",
          description: null,
          appState: "RUNNING",
          computeState: "ACTIVE",
        },
      ],
      nextPageToken: "next-page",
    });
    const secondPage = makePage({
      items: [
        {
          name: "second-app",
          description: null,
          appState: "STOPPED",
          computeState: "IDLE",
        },
      ],
    });
    listWorkspaceAppsMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const { result } = renderHook(() => useWorkspaceApps(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let fetchedPages: IWorkspaceAppsPage[] | undefined;
    await act(async () => {
      const fetchResult = await result.current.fetchNextPage();
      fetchedPages = fetchResult.data?.pages;
    });

    expect(listWorkspaceAppsMock).toHaveBeenNthCalledWith(
      2,
      "next-page",
      expect.anything(),
    );
    expect(fetchedPages).toEqual([firstPage, secondPage]);
  });

  it("exposes request failures to the page", async () => {
    const failure = new Error("workspace denied access");
    listWorkspaceAppsMock.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => useWorkspaceApps(), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(failure);
  });
});
