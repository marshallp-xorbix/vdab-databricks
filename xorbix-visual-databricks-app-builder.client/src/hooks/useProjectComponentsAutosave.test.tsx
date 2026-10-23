import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IProjectComponent } from "../models/ProjectComponents";
import {
  PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS,
  useProjectComponentsAutosave,
} from "./useProjectComponentsAutosave";

afterEach(() => {
  vi.useRealTimers();
});

describe("useProjectComponentsAutosave", () => {
  it("saves the latest draft after the debounce interval", async () => {
    vi.useFakeTimers();
    const firstSave = vi.fn().mockResolvedValue(undefined);
    const latestSave = vi.fn().mockResolvedValue(undefined);
    const draft: IProjectComponent[] = [];
    const { rerender } = renderHook(
      (options) => useProjectComponentsAutosave(options),
      {
        initialProps: {
          draft,
          isDirty: true,
          canSave: true,
          isSaving: false,
          hasError: false,
          onSave: firstSave,
        },
      },
    );

    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS - 1);
    });
    expect(firstSave).not.toHaveBeenCalled();

    rerender({
      draft,
      isDirty: true,
      canSave: true,
      isSaving: false,
      hasError: false,
      onSave: latestSave,
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(firstSave).not.toHaveBeenCalled();
    expect(latestSave).toHaveBeenCalledTimes(1);
  });

  it("restarts the debounce when the draft changes", () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initialDraft: IProjectComponent[] = [];
    const changedDraft: IProjectComponent[] = [
      {
        key: "button-1",
        type: "Button",
        schemaVersion: 1,
        componentVersion: 1,
        codeName: "button1",
        description: null,
        properties: { label: "Continue" },
        bindings: null,
        children: [],
        layout: null,
      },
    ];
    const { rerender } = renderHook(
      (options) => useProjectComponentsAutosave(options),
      {
        initialProps: {
          draft: initialDraft,
          isDirty: true,
          canSave: true,
          isSaving: false,
          hasError: false,
          onSave,
        },
      },
    );

    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS - 1);
    });
    rerender({
      draft: changedDraft,
      isDirty: true,
      canSave: true,
      isSaving: false,
      hasError: false,
      onSave,
    });
    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS - 1);
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not autosave while disabled, saving, or after an error", () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const draft: IProjectComponent[] = [];
    const options = {
      draft,
      isDirty: true,
      canSave: false,
      isSaving: false,
      hasError: false,
      onSave,
    };
    const { rerender } = renderHook(
      (nextOptions) => useProjectComponentsAutosave(nextOptions),
      { initialProps: options },
    );

    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS);
    });
    rerender({ ...options, canSave: true, isSaving: true });
    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS);
    });
    rerender({ ...options, canSave: true, hasError: true });
    act(() => {
      vi.advanceTimersByTime(PROJECT_COMPONENTS_AUTOSAVE_DELAY_MS);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
