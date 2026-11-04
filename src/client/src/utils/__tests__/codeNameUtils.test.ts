import { describe, expect, it } from "vitest";
import {
  applyCodeNamesToLoadedComponents,
  assignCodeNameOnCreate,
  generateUniqueCodeName,
  getCodeNameInputValidationError,
  getCodeNameValidationError,
  MAX_CODE_NAME_LENGTH,
  normalizeCodeName,
} from "../codeNameUtils";
import { createComponent } from "./testingUtils";
import { ComponentType } from "../../types/components/componentTypes";

describe("codeNameUtils", () => {
  it("normalizes code names by trimming and removing blank values", () => {
    expect(normalizeCodeName(undefined)).toBeUndefined();
    expect(normalizeCodeName("   ")).toBeUndefined();
    expect(normalizeCodeName("  buttonOne  ")).toBe("buttonOne");
  });

  it("generates incremented unique code names for collisions", () => {
    const used = new Set(["button1", "button2"]);
    expect(generateUniqueCodeName(ComponentType.Button, used)).toBe("button3");
    expect(used.has("button3")).toBe(true);
  });

  it("assigns code name on create across full app graph", () => {
    const existing = [
      createComponent({
        id: "1",
        type: ComponentType.Button,
        codeName: "button1",
      }),
      createComponent({
        id: "2",
        type: ComponentType.Button,
        codeName: "button2",
      }),
      createComponent({
        id: "m1",
        type: ComponentType.Modal,
        codeName: "modal1",
      }),
    ];

    const created = assignCodeNameOnCreate(
      createComponent({
        id: "3",
        type: ComponentType.Button,
      }),
      existing,
    );

    expect(created.codeName).toBe("button3");
  });

  it("backfills missing code names for loaded components", () => {
    const result = applyCodeNamesToLoadedComponents(
      {
        page_1: [
          createComponent({
            id: "1",
            type: ComponentType.Button,
            codeName: "button1",
          }),
          createComponent({
            id: "2",
            type: ComponentType.Button,
          }),
        ],
      },
      [
        createComponent({
          id: "m1",
          type: ComponentType.Modal,
        }),
      ],
    );

    expect(result.componentContexts.page_1[0].codeName).toBe("button1");
    expect(result.componentContexts.page_1[1].codeName).toBe("button2");
    expect(result.modals[0].codeName).toBe("modal1");
  });

  it("returns descriptive validation errors for missing and duplicate names", () => {
    const missing = getCodeNameValidationError([
      createComponent({ id: "1", type: ComponentType.Button }),
    ]);
    expect(missing).toContain("missing a code name");

    const duplicate = getCodeNameValidationError([
      createComponent({
        id: "1",
        type: ComponentType.Button,
        codeName: "btn1",
      }),
      createComponent({
        id: "2",
        type: ComponentType.TextInput,
        codeName: "btn1",
      }),
    ]);
    expect(duplicate).toContain("used by both component 1 and component 2");
  });

  it("validates codeName input for required, length, and duplicates", () => {
    const components = [
      createComponent({
        id: "1",
        type: ComponentType.Button,
        codeName: "btn1",
      }),
      createComponent({
        id: "2",
        type: ComponentType.TextInput,
        codeName: "input1",
      }),
    ];

    expect(getCodeNameInputValidationError("   ", "1", components)).toBe(
      "Code name is required.",
    );

    expect(
      getCodeNameInputValidationError(
        "x".repeat(MAX_CODE_NAME_LENGTH + 1),
        "1",
        components,
      ),
    ).toContain("cannot exceed");

    expect(
      getCodeNameInputValidationError("input1", "1", components),
    ).toContain("already used");

    expect(
      getCodeNameInputValidationError("btn1", "1", components),
    ).toBeUndefined();
    expect(
      getCodeNameInputValidationError("newName", "1", components),
    ).toBeUndefined();
  });
});
