import { describe, expect, it } from "vitest";
import { normalizeDashboardEmbedReference } from "./dashboardEmbedConfiguration";

describe("normalizeDashboardEmbedReference", () => {
  it("keeps only the dashboard path and widget while discarding workspace authority", () => {
    expect(normalizeDashboardEmbedReference(
      "https://other-workspace.cloud.databricks.com/embed/dashboardsv3/dashboard_12?o=123456&fullscreenWidget=page_1~widget_2",
    )).toEqual({
      ok: true,
      reference: "/embed/dashboardsv3/dashboard_12?fullscreenWidget=page_1~widget_2",
    });
  });

  it.each([
    "http://workspace.cloud.databricks.com/embed/dashboardsv3/dashboard_12",
    "https://user:password@workspace.cloud.databricks.com/embed/dashboardsv3/dashboard_12",
    "//workspace.cloud.databricks.com/embed/dashboardsv3/dashboard_12",
    "/embed/dashboardsv3/dashboard_12/extra",
    "/embed/dashboardsv3/dashboard_12?token=secret",
    "/embed/dashboardsv3/dashboard_12#fragment",
  ])("rejects invalid embed reference %s", (reference) => {
    expect(normalizeDashboardEmbedReference(reference).ok).toBe(false);
  });
});
