import { describe, expect, it } from "vitest";
import type { IWorkspaceTableColumn } from "../models/WorkspaceTable";
import {
  getCartesianChartAxisScales,
  getCartesianChartAxisTransforms,
  readCartesianChartAxis,
} from "./cartesianChartConfiguration";

const numberColumn: IWorkspaceTableColumn = {
  name: "amount",
  type: "DECIMAL(12,2)",
  dataType: "DECIMAL",
};
const textColumn: IWorkspaceTableColumn = {
  name: "region",
  type: "STRING",
  dataType: "STRING",
};

describe("PieChart axis configuration", () => {
  it("uses categorical category and summed continuous value defaults", () => {
    expect(readCartesianChartAxis(undefined, "category", "PieChart")).toEqual({
      field: "",
      displayName: "",
      scaleType: "categorical",
      transform: "none",
    });
    expect(readCartesianChartAxis(undefined, "value", "PieChart")).toEqual({
      field: "",
      displayName: "",
      scaleType: "continuous",
      transform: "sum",
    });
  });

  it("offers category passthrough and type-compatible value transforms", () => {
    expect(getCartesianChartAxisTransforms("category", textColumn, "PieChart")).toEqual(["none"]);
    expect(getCartesianChartAxisTransforms("value", numberColumn, "PieChart")).toEqual([
      "none", "sum", "avg", "count", "count_distinct", "min", "max",
    ]);
    expect(getCartesianChartAxisTransforms("value", textColumn, "PieChart")).toEqual([
      "count", "count_distinct",
    ]);
  });

  it("locks PieChart axes to category and value scales", () => {
    expect(getCartesianChartAxisScales("category", textColumn)).toEqual(["categorical"]);
    expect(getCartesianChartAxisScales("value", numberColumn)).toEqual(["continuous"]);
  });
});

describe("DonutChart axis configuration", () => {
  it("uses the same category and value defaults and transformations as PieChart", () => {
    expect(readCartesianChartAxis(undefined, "category", "DonutChart")).toEqual({
      field: "",
      displayName: "",
      scaleType: "categorical",
      transform: "none",
    });
    expect(readCartesianChartAxis(undefined, "value", "DonutChart")).toEqual({
      field: "",
      displayName: "",
      scaleType: "continuous",
      transform: "sum",
    });
    expect(getCartesianChartAxisTransforms("value", numberColumn, "DonutChart")).toContain("sum");
  });
});
