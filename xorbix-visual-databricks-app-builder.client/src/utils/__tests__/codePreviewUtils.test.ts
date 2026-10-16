import { describe, expect, it } from "vitest";
import {
  buildCodeTree,
  chooseDefaultCodeFilePath,
  countVisibleCodeTreeRows,
  inferMonacoLanguage,
} from "../codePreviewUtils";

describe("codePreviewUtils", () => {
  it("prefers previous selection when still present", () => {
    const files = [
      { path: "app.py", content: "" },
      { path: "requirements.txt", content: "" },
    ];

    const selected = chooseDefaultCodeFilePath(files, "requirements.txt");
    expect(selected).toBe("requirements.txt");
  });

  it("falls back to app.py when previous selection is missing", () => {
    const files = [
      { path: "requirements.txt", content: "" },
      { path: "app.py", content: "" },
    ];

    const selected = chooseDefaultCodeFilePath(files, "missing.py");
    expect(selected).toBe("app.py");
  });

  it("builds nested tree nodes from path segments", () => {
    const tree = buildCodeTree([
      { path: "app.py", content: "" },
      { path: ".streamlit/config.toml", content: "" },
    ]);

    expect(tree.some((node) => node.fullPath === "app.py")).toBe(true);
    const streamlit = tree.find((node) => node.fullPath === ".streamlit");
    expect(streamlit?.isDirectory).toBe(true);
    expect(streamlit?.children?.[0].fullPath).toBe(".streamlit/config.toml");
  });

  it("countVisibleCodeTreeRows counts only expanded directories", () => {
    const tree = buildCodeTree([
      { path: "app.py", content: "" },
      { path: ".streamlit/config.toml", content: "" },
    ]);

    expect(countVisibleCodeTreeRows(tree, {})).toBe(2);

    expect(
      countVisibleCodeTreeRows(tree, { ".streamlit": true }),
    ).toBe(3);
  });

  it("infers Monaco language by extension", () => {
    expect(inferMonacoLanguage("app.py")).toBe("python");
    expect(inferMonacoLanguage("app.yaml")).toBe("yaml");
    expect(inferMonacoLanguage(".streamlit/config.toml")).toBe("ini");
    expect(inferMonacoLanguage("README.txt")).toBe("plaintext");
  });
});
