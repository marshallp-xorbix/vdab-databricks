import { describe, expect, it } from "vitest";
import {
  PAGE_WIDTH_DEFAULT,
  PAGE_WIDTH_MAX,
  PAGE_WIDTH_MIN,
  PAGE_WIDTH_THEME_KEY,
  clampPageWidth,
  getPageWidthFromTheme,
  parsePageWidth,
} from "./pageWidthDefaults";

describe("pageWidthDefaults", () => {
  it("parsePageWidth_MissingOrInvalid_ReturnsDefault", () => {
    expect(parsePageWidth(undefined)).toBe(PAGE_WIDTH_DEFAULT);
    expect(parsePageWidth(null)).toBe(PAGE_WIDTH_DEFAULT);
    expect(parsePageWidth("")).toBe(PAGE_WIDTH_DEFAULT);
    expect(parsePageWidth("abc")).toBe(PAGE_WIDTH_DEFAULT);
  });

  it("parsePageWidth_BelowMin_ClampsToMin", () => {
    expect(parsePageWidth(500)).toBe(PAGE_WIDTH_MIN);
    expect(parsePageWidth("500")).toBe(PAGE_WIDTH_MIN);
  });

  it("parsePageWidth_AboveMax_ClampsToMax", () => {
    expect(parsePageWidth(2000)).toBe(PAGE_WIDTH_MAX);
    expect(parsePageWidth("2000")).toBe(PAGE_WIDTH_MAX);
  });

  it("clampPageWidth_InRange_ReturnsRoundedValue", () => {
    expect(clampPageWidth(960.4)).toBe(960);
    expect(clampPageWidth(1100)).toBe(1100);
  });

  it("parsePageWidth_NumericEdgeCases_MatchBackend", () => {
    expect(parsePageWidth("-100")).toBe(PAGE_WIDTH_MIN);
    expect(parsePageWidth("1100.5")).toBe(1101);
    expect(parsePageWidth("2000000000000")).toBe(PAGE_WIDTH_MAX);
  });

  it("getPageWidthFromTheme_ReadsThemeKey", () => {
    expect(getPageWidthFromTheme(undefined)).toBe(PAGE_WIDTH_DEFAULT);
    expect(
      getPageWidthFromTheme({ [PAGE_WIDTH_THEME_KEY]: "1200" }),
    ).toBe(1200);
  });
});
