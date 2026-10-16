export type ChartColumnTypeCategory =
  | "temporal"
  | "numeric"
  | "string"
  | "boolean"
  | "unknown";

/**
 * Classifies Unity Catalog / Spark SQL / Postgres type strings for chart UI (icons, hints).
 * Types are often lowercased but not guaranteed; matching is case-insensitive.
 * Lakebase (Postgres) returns values like "double precision" and "timestamp without time zone".
 */
export function getChartColumnTypeCategory(
  typeText: string | undefined,
): ChartColumnTypeCategory {
  if (!typeText || typeText.trim().length === 0) {
    return "unknown";
  }

  const t = typeText.trim().toLowerCase();

  if (
    t === "date" ||
    t.includes("timestamp") ||
    t.includes("timestamp_ntz") ||
    t === "time" ||
    t.startsWith("time ")
  ) {
    return "temporal";
  }

  if (
    t === "boolean" ||
    t === "bool" ||
    t.startsWith("boolean")
  ) {
    return "boolean";
  }

  if (
    t === "tinyint" ||
    t === "smallint" ||
    t === "int" ||
    t === "integer" ||
    t === "bigint" ||
    t === "long" ||
    t === "real" ||
    t === "int2" ||
    t === "int4" ||
    t === "int8" ||
    t === "money" ||
    t.includes("double") ||
    t.includes("decimal") ||
    t.includes("numeric") ||
    t.includes("number") ||
    t.includes("float") ||
    t.includes("serial")
  ) {
    return "numeric";
  }

  if (
    t.includes("varchar") ||
    t.includes("char") ||
    t === "string" ||
    t.includes("text") ||
    t.includes("binary") ||
    t.includes("variant")
  ) {
    return "string";
  }

  if (t.includes("array") || t.includes("map") || t.includes("struct")) {
    return "string";
  }

  return "unknown";
}
