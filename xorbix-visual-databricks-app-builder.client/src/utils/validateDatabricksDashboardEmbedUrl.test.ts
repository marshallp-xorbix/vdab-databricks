import { describe, expect, it } from "vitest";
import { validateDatabricksDashboardEmbedUrl } from "./validateDatabricksDashboardEmbedUrl";

const WORKSPACE = "https://adb-1234567890123456.7.azuredatabricks.net";

function embedPath(dashboardId: string): string {
  return `${WORKSPACE}/embed/dashboardsv3/${dashboardId}`;
}

describe("validateDatabricksDashboardEmbedUrl", () => {
  it("accepts empty src", () => {
    expect(validateDatabricksDashboardEmbedUrl("  ", WORKSPACE)).toEqual({
      ok: true,
    });
    expect(validateDatabricksDashboardEmbedUrl("", null)).toEqual({
      ok: true,
    });
  });

  it("rejects non-empty src when workspace URL is missing", () => {
    const result = validateDatabricksDashboardEmbedUrl(embedPath("abc"), null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Workspace URL is missing");
    }
  });

  it("rejects invalid workspace URL when src is set", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      embedPath("abc"),
      "not-a-url",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("workspace URL is not valid");
    }
  });

  it("rejects non-HTTPS embed", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      "http://adb-1234567890123456.7.azuredatabricks.net/embed/dashboardsv3/x",
      WORKSPACE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Dashboard embed URL must use HTTPS.");
    }
  });

  it("rejects userinfo in embed URL", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      "https://user:pass@adb-1234567890123456.7.azuredatabricks.net/embed/dashboardsv3/x",
      WORKSPACE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Dashboard embed URL is not valid.");
    }
  });

  it("rejects host mismatch", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      "https://other.7.azuredatabricks.net/embed/dashboardsv3/x",
      WORKSPACE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("same workspace host");
    }
  });

  it("rejects unknown host suffix", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      "https://adb-1234567890123456.7.azuredatabricks.net.evil.com/embed/dashboardsv3/x",
      "https://adb-1234567890123456.7.azuredatabricks.net.evil.com",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("not recognized as a Databricks");
    }
  });

  it("rejects wrong path prefix", () => {
    const result = validateDatabricksDashboardEmbedUrl(
      `${WORKSPACE}/dashboard/foo`,
      WORKSPACE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Lakeview embed path");
    }
  });

  it("rejects embed path without dashboard id (extra path segments)", () => {
    const extraSlash = validateDatabricksDashboardEmbedUrl(
      `${WORKSPACE}/embed/dashboardsv3/ab/extra`,
      WORKSPACE,
    );
    expect(extraSlash.ok).toBe(false);
    if (!extraSlash.ok) {
      expect(extraSlash.message).toContain("valid dashboard id");
    }
  });

  it("accepts valid Lakeview embed URL", () => {
    expect(
      validateDatabricksDashboardEmbedUrl(embedPath("lakeview-id-1"), WORKSPACE),
    ).toEqual({ ok: true });
  });

  it("accepts cloud.databricks.com host", () => {
    const ws = "https://my-workspace.cloud.databricks.com";
    expect(
      validateDatabricksDashboardEmbedUrl(
        `${ws}/embed/dashboardsv3/dash1`,
        ws,
      ),
    ).toEqual({ ok: true });
  });
});
