import { describe, expect, it } from "vitest";
import { WorkspaceAppSummary } from "../models/WorkspaceApp";
import { readWorkspaceAppStatus } from "./workspaceAppStatus";

describe("readWorkspaceAppStatus", () => {
  it.each(["STARTING", "STOPPING", "UPDATING"])(
    "reports %s before unavailable or old running state",
    (computeState) => {
      const app = new WorkspaceAppSummary({
        computeState,
        appState: "UNAVAILABLE",
      });
      expect(readWorkspaceAppStatus(app)).not.toBe("Offline");
      app.appState = "RUNNING";
      expect(readWorkspaceAppStatus(app)).not.toBe("Running");
    },
  );
  it("reports active compute without running code as Ready", () => {
    expect(
      readWorkspaceAppStatus(
        new WorkspaceAppSummary({
          computeState: "ACTIVE",
          appState: "UNAVAILABLE",
        }),
      ),
    ).toBe("Ready");
  });
  it("reports running code and stopped compute distinctly", () => {
    expect(
      readWorkspaceAppStatus(
        new WorkspaceAppSummary({
          computeState: "ACTIVE",
          appState: "RUNNING",
        }),
      ),
    ).toBe("Running");
    expect(
      readWorkspaceAppStatus(
        new WorkspaceAppSummary({
          computeState: "STOPPED",
          appState: "UNAVAILABLE",
        }),
      ),
    ).toBe("Offline");
  });
});
