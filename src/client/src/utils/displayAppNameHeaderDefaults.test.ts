import { describe, expect, it } from "vitest";
import {
  DISPLAY_APP_NAME_HEADER_DEFAULT,
  DISPLAY_APP_NAME_HEADER_THEME_KEY,
  getDisplayAppNameHeaderFromTheme,
  parseDisplayAppNameHeader,
} from "./displayAppNameHeaderDefaults";

describe("displayAppNameHeaderDefaults", () => {
  it("parseDisplayAppNameHeader_MissingOrInvalid_ReturnsDefault", () => {
    expect(parseDisplayAppNameHeader(undefined)).toBe(
      DISPLAY_APP_NAME_HEADER_DEFAULT,
    );
    expect(parseDisplayAppNameHeader(null)).toBe(
      DISPLAY_APP_NAME_HEADER_DEFAULT,
    );
    expect(parseDisplayAppNameHeader("")).toBe(DISPLAY_APP_NAME_HEADER_DEFAULT);
    expect(parseDisplayAppNameHeader("yes")).toBe(
      DISPLAY_APP_NAME_HEADER_DEFAULT,
    );
    expect(parseDisplayAppNameHeader(1)).toBe(DISPLAY_APP_NAME_HEADER_DEFAULT);
  });

  it("parseDisplayAppNameHeader_BooleanAndString_ReturnsNormalized", () => {
    expect(parseDisplayAppNameHeader(true)).toBe(true);
    expect(parseDisplayAppNameHeader(false)).toBe(false);
    expect(parseDisplayAppNameHeader("true")).toBe(true);
    expect(parseDisplayAppNameHeader("FALSE")).toBe(false);
    expect(parseDisplayAppNameHeader(" True ")).toBe(true);
  });

  it("getDisplayAppNameHeaderFromTheme_ReadsThemeKey", () => {
    expect(getDisplayAppNameHeaderFromTheme(undefined)).toBe(
      DISPLAY_APP_NAME_HEADER_DEFAULT,
    );
    expect(
      getDisplayAppNameHeaderFromTheme({
        [DISPLAY_APP_NAME_HEADER_THEME_KEY]: "true",
      }),
    ).toBe(true);
    expect(
      getDisplayAppNameHeaderFromTheme({
        [DISPLAY_APP_NAME_HEADER_THEME_KEY]: "false",
      }),
    ).toBe(false);
  });
});
