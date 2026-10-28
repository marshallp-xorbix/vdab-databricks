import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { componentRegistryFixture } from "./componentRegistryFixture";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string | undefined) => void;
    options: { ariaLabel?: string };
  }) => createElement("textarea", {
    "aria-label": options.ariaLabel ?? "Editor content",
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  }),
}));

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: () => undefined,
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => undefined,
});
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
});
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});

beforeEach(() => {
  if (process.env.VITE_VDAB_RUNTIME !== "databricks") return;

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    const requestPath = new URL(requestUrl, "http://localhost").pathname;

    if (requestPath.endsWith("/api/v1/component-definitions")) {
      return Response.json(componentRegistryFixture);
    }
    if (requestPath.endsWith("/api/v1/session")) {
      return Response.json({
        userId: "test-user",
        preferredUsername: "VDAB test user",
        email: "vdab-test@example.invalid",
        workspace: { id: "test-workspace", host: "https://workspace.example.invalid" },
        authenticationMode: "databricks",
        installationAdmin: true,
      });
    }

    return Response.json({ detail: "The editor test did not configure this request." }, { status: 404 });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
