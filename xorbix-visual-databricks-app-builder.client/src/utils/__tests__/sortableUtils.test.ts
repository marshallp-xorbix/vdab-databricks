import { describe, expect, it } from "vitest";
import { getInsertionIndexFromPointer } from "../sortableUtils";

describe("sortableUtils", () => {
  it("computes insertion index for vertical lists", () => {
    const items = [
      {
        id: "A-DataWindow",
        rect: {
          top: 128,
          bottom: 384,
          left: 244.8,
          right: 780.8,
          width: 536,
          height: 256,
        },
      },
      {
        id: "B-BarChart",
        rect: {
          top: 400,
          bottom: 700,
          left: 244.8,
          right: 780.8,
          width: 536,
          height: 300,
        },
      },
    ];

    expect(getInsertionIndexFromPointer(items, { x: 576, y: 120 })).toBe(0);
    expect(getInsertionIndexFromPointer(items, { x: 483, y: 395 })).toBe(1);
    expect(getInsertionIndexFromPointer(items, { x: 552, y: 711 })).toBe(2);
  });

  it("returns 0 for empty lists", () => {
    expect(getInsertionIndexFromPointer([], { x: 0, y: 10 })).toBe(0);
  });

  it("inserts before an item when pointer is at midpoint", () => {
    const items = [
      {
        id: "A",
        rect: {
          top: 0,
          bottom: 10,
          left: 0,
          right: 100,
          width: 100,
          height: 10,
        },
      },
      {
        id: "B",
        rect: {
          top: 20,
          bottom: 40,
          left: 0,
          right: 100,
          width: 100,
          height: 20,
        },
      },
    ];

    expect(getInsertionIndexFromPointer(items, { x: 5, y: 5 })).toBe(0);
    expect(getInsertionIndexFromPointer(items, { x: 5, y: 30 })).toBe(1);
  });

  it("sorts by top before computing insertion index", () => {
    const items = [
      {
        id: "B",
        rect: {
          top: 20,
          bottom: 30,
          left: 0,
          right: 100,
          width: 100,
          height: 10,
        },
      },
      {
        id: "A",
        rect: {
          top: 0,
          bottom: 10,
          left: 0,
          right: 100,
          width: 100,
          height: 10,
        },
      },
    ];

    expect(getInsertionIndexFromPointer(items, { x: 10, y: 5 })).toBe(0);
    expect(getInsertionIndexFromPointer(items, { x: 10, y: 25 })).toBe(1);
    expect(getInsertionIndexFromPointer(items, { x: 10, y: 35 })).toBe(2);
  });

  it("handles varying heights and ignores x position", () => {
    const items = [
      {
        id: "A",
        rect: {
          top: 0,
          bottom: 10,
          left: 0,
          right: 100,
          width: 100,
          height: 10,
        },
      },
      {
        id: "B",
        rect: {
          top: 12,
          bottom: 52,
          left: 0,
          right: 100,
          width: 100,
          height: 40,
        },
      },
    ];

    expect(getInsertionIndexFromPointer(items, { x: -999, y: 9 })).toBe(1);
    expect(getInsertionIndexFromPointer(items, { x: 999, y: 32 })).toBe(1);
    expect(getInsertionIndexFromPointer(items, { x: 999, y: 60 })).toBe(2);
  });
});
