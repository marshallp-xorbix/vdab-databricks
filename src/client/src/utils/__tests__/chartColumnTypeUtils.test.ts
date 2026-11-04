import { describe, expect, it } from "vitest";
import { getChartColumnTypeCategory } from "../chartColumnTypeUtils";

describe("getChartColumnTypeCategory", () => {
  it("classifies Postgres Lakebase numeric types", () => {
    expect(getChartColumnTypeCategory("double precision")).toBe("numeric");
    expect(getChartColumnTypeCategory("real")).toBe("numeric");
    expect(getChartColumnTypeCategory("numeric")).toBe("numeric");
    expect(getChartColumnTypeCategory("integer")).toBe("numeric");
    expect(getChartColumnTypeCategory("bigint")).toBe("numeric");
    expect(getChartColumnTypeCategory("float8")).toBe("numeric");
    expect(getChartColumnTypeCategory("int4")).toBe("numeric");
  });

  it("classifies Postgres temporal types", () => {
    expect(getChartColumnTypeCategory("timestamp without time zone")).toBe(
      "temporal",
    );
    expect(getChartColumnTypeCategory("date")).toBe("temporal");
  });

  it("classifies Postgres time-without-zone and money/serial types", () => {
    expect(getChartColumnTypeCategory("time without time zone")).toBe(
      "temporal",
    );
    expect(getChartColumnTypeCategory("money")).toBe("numeric");
    expect(getChartColumnTypeCategory("bigserial")).toBe("numeric");
    expect(getChartColumnTypeCategory("int2")).toBe("numeric");
  });

  it("classifies Spark / UC types", () => {
    expect(getChartColumnTypeCategory("DOUBLE")).toBe("numeric");
    expect(getChartColumnTypeCategory("STRING")).toBe("string");
  });
});
