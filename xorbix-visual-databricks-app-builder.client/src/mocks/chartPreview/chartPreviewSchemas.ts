import type { JsonSchema } from "json-schema-faker";

/** Single numeric measure (bar Y / line Y preview). */
export const chartPreviewMeasureRowSchema: JsonSchema = {
  type: "object",
  properties: {
    value: {
      type: "integer",
      faker: { "number.int": [{ min: 8, max: 2200 }] },
    },
  },
  required: ["value"],
};

/** One pie / donut slice. */
export const chartPreviewSliceRowSchema: JsonSchema = {
  type: "object",
  properties: {
    category: { type: "string", faker: "commerce.department" },
    value: {
      type: "integer",
      faker: { "number.int": [{ min: 12, max: 140 }] },
    },
  },
  required: ["category", "value"],
};
