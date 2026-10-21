import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

afterEach(() => {
  cleanup();
});
