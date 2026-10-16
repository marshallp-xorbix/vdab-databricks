import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../../../context/ThemeContext";
import AppThemeTab from "./AppThemeTab";

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("AppThemeTab", () => {
  it("falls back to valid hex colors for missing or invalid values", () => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");

    const { container } = renderWithTheme(
      <AppThemeTab
        appTheme={{
          primaryColor: "var(--primary)",
          backgroundColor: "not-a-color",
        }}
        onThemeColorChange={vi.fn()}
      />,
    );

    const colorInputs = Array.from(
      container.querySelectorAll('input[type="color"]'),
    ) as HTMLInputElement[];
    expect(colorInputs).toHaveLength(4);

    const values = colorInputs.map((input) => input.value.toUpperCase());
    expect(values).toEqual(["#0078D4", "#252526", "#2D2D30", "#CCCCCC"]);
  });

  it("propagates color changes through parent callback", () => {
    const onThemeColorChange = vi.fn();
    const { container } = renderWithTheme(
      <AppThemeTab appTheme={{}} onThemeColorChange={onThemeColorChange} />,
    );

    const primaryColorInput = container.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement;
    fireEvent.change(primaryColorInput, { target: { value: "#112233" } });

    expect(onThemeColorChange).toHaveBeenCalledWith("primaryColor", "#112233");
  });
});
